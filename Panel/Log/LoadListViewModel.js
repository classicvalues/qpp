// Google BSD license http://code.google.com/google_bsd_license.html
// Copyright 2012 Google Inc. johnjbarton@google.com

// History of past turn-sets or "loads"
// Current load is in the statusbar.
// Currently - shown load is on the left in the turn scrubber
// Next -shown load in the right in the turn scrubber.
// History of loads drops down from the left load.

(function() {

  'use strict';

  var debug = DebugLogger.register('LoadListViewModel', function(flag){
    return debug = (typeof flag === 'boolean') ? flag : debug;
  });

  QuerypointPanel.LoadModel = function(loadNumber) { 
    this.loadNumber = loadNumber || '-';
    this.turns = ko.observableArray();
    this.turnEnded = ko.observable(0);
    this.currentTurn = ko.computed(function() {
      if (this.turns().length)
        return this.turns()[this.turnStarted() - 1];
    }.bind(this));
    this.turnStarted = ko.computed(function() {
      return this.turns().length;
    }.bind(this));
  }

  QuerypointPanel.LoadModel.prototype = {
    onTurnStarted: function(turnInfo) {
      this.turns.push(new QuerypointPanel.Turn(turnInfo));
      console.assert(this.turns().length = turnInfo.turnNumber);
    },
    onTurnEnded: function(turnNumber) {
      console.assert(this.turnStarted() === turnNumber);
      this.turnEnded(turnNumber);
    },
    causalChain: function(turn) {
      var causedBy = this.turns()[turn.registrationTurnNumber];
      if (causedBy) {
        var chain = this.causalChain(causedBy);
        chain.push(causedBy);
        return chain;
      } else {
        return [];
      }
    }
  };

  QuerypointPanel.LoadListViewModel = {
    
    initialize: function(sessionViewModel) {
      this.loadViewModels = ko.observableArray();

      var loadListView = document.querySelector('.loadListView');
      
      this.lastLoad = ko.computed(function() {
        var last = this.loadViewModels().length - 1;
        if (debug) console.log('LoadListViewModel.lastLoad ' +last + " loads");
        return this.loadViewModels()[last];
      }.bind(this));
      
      var self = this;
      this.showLoad = ko.observable({});
      this.loadStartedNumber = ko.computed(function() {
        return this.loadViewModels().length;
      }.bind(this));
      this.loadEndedNumber = ko.observable(0);

      var sessionView = document.querySelector('.sessionView');  // Remove afer FIXME
      
      this.displayLoad = function(loadModel) {
        this.showLoad(loadModel);

        var loadElement = document.querySelector('div.loadNumber[load="' + loadModel.loadNumber + '"]');
        this.selectLoad(loadElement);

        sessionViewModel.turnScrubberViewModel.updateOnLoadSelection(this.currentLoadIsSelected(), loadModel);
      }

      this.showLoadNumber = ko.computed(function(){
          return this.showLoad().loadNumber || '-';
      }.bind(this));

      this.showNextLoadNumber = ko.computed( function(){
          var loadNumber = this.showLoadNumber();
          if (loadNumber === '-' || loadNumber == this.loadStartedNumber()) {
              return '-';
          } else {
              return loadNumber + 1;
          }
      }.bind(this));

      this.currentLoadIsSelected = ko.computed( function(){
        return self.showLoad().loadNumber == self.loadStartedNumber();
      });

      this.isPastLoad = ko.computed( function(){
        return self.loadStartedNumber() && (self.showLoad().loadNumber != self.loadStartedNumber());
      });
    
      var loadListView = document.querySelector('.loadListView');
      ko.applyBindings(this, loadListView);

      return this;
    },

    onClickLoad: function(loadModel) {
      if (loadModel instanceof QuerypointPanel.LoadModel) {
        this.displayLoad(loadModel);
      }
    },
  
    selectLoad: function(node){
        if (!node.classList) return;
        var element = document.querySelector('.selectedLoad');
        if(element) element.classList.remove('selectedLoad');
        node.classList.add('selectedLoad');
        // Shift the list to place the current number in line with the scrubber
        var loadNumber = this.showLoadNumber();
        if (typeof loadNumber === 'number') 
          node.parentElement.style.top = ((loadNumber - 1) * 15) + 'px';
    },

    pageWasReloaded: function(runtimeInstalled, runtimeInstalling) {
    },

    onBeginLoad: function(loadNumber) {
      var loadViewModel = new QuerypointPanel.LoadModel(loadNumber);
      this.showLoad().next = loadViewModel;
      this.showLoad(loadViewModel);
      this.loadViewModels.push(loadViewModel);
      console.assert(this.loadViewModels().length === loadNumber);
    },
    
    onEndLoad: function(loadNumber) {
      console.assert(loadNumber === this.loadStartedNumber());
      this.loadEndedNumber(loadNumber);
    }
  };
}());
