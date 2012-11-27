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
  
  Template.home.etherpads = function() {
    return Etherpads.find();
  };
  
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
  });
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
  });
}
