var Etherpads = new Meteor.Collection("etherpads");
var CachedEtherpads = new Meteor.Collection("cachedpads");

var RECACHE_ETHERPAD_INTERVAL = 10000;
var MIN_RECACHE_INTERVAL = 5000;

if (Meteor.isClient) {
  
  ////////// Helpers for in-place editing //////////

  // https://github.com/meteor/meteor/blob/master/examples/todos/client/todos.js
  // Returns an event map that handles the "escape" and "return" keys and
  // "blur" events on a text input (given by selector) and interprets them
  // as "ok" or "cancel".
  var okCancelEvents = function (selector, callbacks) {
    var ok = callbacks.ok || function () {};
    var cancel = callbacks.cancel || function () {};

    var events = {};
    events['keyup '+selector+', keydown '+selector+', focusout '+selector] =
      function (evt) {
        if (evt.type === "keydown" && evt.which === 27) {
          // escape = cancel
          cancel.call(this, evt);

        } else if (evt.type === "keyup" && evt.which === 13 
                                        && !evt.shiftKey ||
                   evt.type === "focusout") {
          // blur/return/enter = ok/submit if non-empty
          var value = String(evt.target.value || "");
          if (value)
            ok.call(this, value, evt);
          else
            cancel.call(this, evt);
        }
      };
    return events;
  };
  
  Session.set("etherpadId", null);
  Session.set("isEditing", false);
  
  Template.main.etherpadId = function() {
    return Session.get("etherpadId");
  };
  
  Template.main.isEditing = function() {
    return Session.get("isEditing");
  };
  
  Template.main.etherpad = function() {
    return Etherpads.findOne({shortname: Session.get("etherpadId")});
  };

  Template.main.etherpads = function() {
    return Etherpads.find({shortname: Session.get("etherpadId")});
  };
  
  Template.main.isHomepage = function() {
    return Session.get("etherpadId") === null;
  };
  
  Template.main.ready = function() {
    return Session.get("ready");
  };
  
  Template.home.etherpads = function() {
    return Etherpads.find();
  };
  
  Template.editField.events({
    'click div.click-to-edit': function(evt, tmpl) {
      Session.set("editing_" + this.param, this.context._id);
      Meteor.flush();
      var input = tmpl.find('input');
      input.focus();
      input.select();
    }
  });
  
  Template.editField.events(okCancelEvents('input', {
    ok: function(value) {
      var update = {};
      update[this.param] = value;
      this.collection.update({_id: this.context._id}, {
        $set: update
      });
      Session.set("editing_" + this.param, null);
    },
    cancel: function() {
      Session.set("editing_" + this.param, null);
    }
  }));
  
  Template.editField.helpers({
    editing: function() {
      return this.context._id == Session.get("editing_" + this.param);
    },
    value: function() {
      return this.context[this.param];
    }
  });
  
  Template.edit.helpers({
    editField: function(param) {
      return new Handlebars.SafeString(Template.editField({
        context: this,
        collection: Etherpads,
        param: param
      }));
    }
  });
  
  Template.edit.events({
    'submit': function(evt, tmpl) {
      var update = {};
      tmpl.findAll("input").forEach(function(input) {
        update[input.name] = input.value;
      });
      Etherpads.update({_id: this._id}, {$set: update});
      evt.preventDefault();
    },
    'click #destroy-coaster': function(evt) {
      Etherpads.remove({_id: this._id});
    }
  });
  
  Template.main.events({
    'click #create-coaster': function(evt) {
      Etherpads.insert({shortname: Session.get("etherpadId")});
    }
  });
  
  Template.cachedContent.exists = function() {
    return !!this.lastCacheEnd;
  };
  
  Template.cachedContent.lastRetrieved = function() {
    return (new Date(this.lastCacheEnd)).toString();
  };
  
  Template.cachedContent.caches = function() {
    return CachedEtherpads.find({
      url: this.url
    });
  };
  
  var EthercoasterRouter = Backbone.Router.extend({
    routes: {
      ":etherpadId": "etherpad",
      ":etherpadId/edit": "editEtherpad",
      "": "home"
    },
    home: function() {
      Session.set("etherpadId", null);
      Session.set("isEditing", false);
    },
    etherpad: function(etherpadId) {
      Session.set("etherpadId", etherpadId);
      Session.set("isEditing", false);
    },
    editEtherpad: function(etherpadId) {
      Session.set("etherpadId", etherpadId);
      Session.set("isEditing", true);
    }
  });
  
  var Router = new EthercoasterRouter();
  
  Meteor.startup(function () {
    Backbone.history.start({pushState: true});
    Meteor.subscribe("etherpads", function() {
      Session.set("ready", true);
    });
    Meteor.autosubscribe(function() {
      if (Session.get("isEditing") && Session.get("etherpadId") !== null) {
        var pad = Etherpads.findOne({shortname: Session.get("etherpadId")});
        if (pad && pad.url)
          Meteor.subscribe("cachedEtherpads", pad.url);
      }
    });
    Meteor.setInterval(function() {
      if (Session.get("etherpadId") !== null)
        Meteor.call("recacheEtherpad", Session.get("etherpadId"));
    }, RECACHE_ETHERPAD_INTERVAL);
  });
}

if (Meteor.isServer) {  
  Meteor.startup(function () {
    Meteor.methods({
      recacheEtherpad: function(etherpadId) {
        var padTextUrl;
        var pad = Etherpads.findOne({
          shortname: etherpadId
        });
        if (!(pad && typeof(pad.url) == "string"))
          return;
        var cachedPad = CachedEtherpads.findOne({
          url: pad.url
        });
        if (!cachedPad) {
          cachedPad = {
            url: pad.url,
            lastCacheStart: 0,
            lastCacheEnd: 0,
            text: ""
          };
          cachedPad._id = CachedEtherpads.insert(cachedPad);
        }
        var start = Date.now();
        if (start - cachedPad.lastCacheStart < MIN_RECACHE_INTERVAL)
          return;
        CachedEtherpads.update({
          url: pad.url
        }, {$set: {lastCacheStart: start}});
        if (pad.url.indexOf("/p/") != -1) {
          // Assume it's an etherpad lite pad.
          padTextUrl = pad.url + "/export/txt";
        } else {
          // Assume it's an etherpad pad.
          var parse = __meteor_bootstrap__.require('url').parse;
          var parts = parse(pad.url);
          padTextUrl = parts.protocol + "//" + parts.host +
                       "/ep/pad/export" + parts.pathname + 
                       "/latest?format=txt";
        }
        this.unblock();
        var result = Meteor.http.call("GET", padTextUrl);
        if (result.statusCode == 200 &&
            result.headers['content-type'].indexOf('text/plain') == 0) {
          CachedEtherpads.update({
            url: pad.url
          }, {$set: {
            lastCacheEnd: Date.now(),
            text: result.content
          }});
        }
      }
    });
    Meteor.publish("cachedEtherpads", function(url) {
      return CachedEtherpads.find({
        url: url
      });
    });
    Meteor.publish("etherpads", function() {
      return Etherpads.find({});
    });
  });
}
