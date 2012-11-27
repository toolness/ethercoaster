var Etherpads = new Meteor.Collection("etherpads");

if (Meteor.isClient) {
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
  
  Template.edit.isChanged = function() {
    return Session.get("isEditingChanged");
  };
  
  Template.edit.created = function() {
    Session.set("isEditingChanged", false);
  };
  
  Template.edit.events({
    'submit': function(evt, tmpl) {
      var update = {};
      tmpl.findAll("input").forEach(function(input) {
        if (input.value != input.getAttribute("data-original-value"))
          update[input.name] = input.value;
      });
      Etherpads.update({_id: this._id}, {$set: update});
      Session.set("isEditingChanged", false);
      evt.preventDefault();
    },
    'click .cancel': function(evt, tmpl) {
      tmpl.findAll("input").forEach(function(input) {
        input.value = input.getAttribute("data-original-value");
      });
      Session.set("isEditingChanged", false);
    },
    'keyup input, keydown input, focusout input': function(evt) {
      Session.set("isEditingChanged",
                  evt.target.value != evt.target.getAttribute("data-original-value"));
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
    },
    setEtherpad: function(etherpadId) {
      this.navigate(etherpadId, true);
    }
  });
  
  var Router = new EthercoasterRouter();
  
  Meteor.startup(function () {
    Backbone.history.start({pushState: true});
  });
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
  });
}
