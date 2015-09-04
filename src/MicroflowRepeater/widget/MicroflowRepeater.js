/*jslint white:true, nomen: true, plusplus: true */
/*global mx, define, require, browser, devel, console */
/*mendix */

// Required module list. Remove unnecessary modules, you can always get them back from the boilerplate.
require([
    'dojo/_base/declare', 'mxui/widget/_WidgetBase',
    'mxui/dom', 'dojo/dom', 'dojo/query', 'dojo/dom-prop', 'dojo/dom-geometry', 'dojo/dom-class', 'dojo/dom-style', 'dojo/dom-construct', 'dojo/_base/array', 'dojo/_base/lang', 'dojo/text'
], function (declare, _WidgetBase, dom, dojoDom, domQuery, domProp, domGeom, domClass, domStyle, domConstruct, dojoArray, lang, text) {
    'use strict';

    // Declare widget's prototype.
    return declare('MicroflowRepeater.widget.MicroflowRepeater', [_WidgetBase], {


        // Parameters configured in the Modeler.
        timeout: 1000,
        execute_once: false,
        start_at_once: true,
        repeat_on_callback: true,
        microflow: "",
        callback_js: "",

        // Internal variables. Non-primitives created in the prototype are shared between all widget instances.
        _handle: null,
        _contextObj: null,
        _latest_timer_id: null,
        _blocked : null,
        _subscribed : false,
        _timer_running : false,

        // dijit._WidgetBase.postCreate is called after constructing the widget. Implement to do extra setup work.
        postCreate: function () {
            console.log(this.id + '.postCreate');
            this._subscribed = false;
        },

        // mxui.widget._WidgetBase.update is called when context is changed or initialized. Implement to re-render and / or fetch data.
        update: function (obj, callback) {
            this._contextObj = obj;
            this._runTimer();
            console.log(this.id + '.update');

            if(!this._subscribed) {
                this._subscribed = true;
                console.log(this.id + '.subscribe_GUID: '+this._contextObj);
                this.subscribe({
                    guid : this._contextObj,
                    callback : lang.hitch(this, function(guid) {
                        if (!this.execute_once && !this._timer_running) { //when not already running
                            console.log(this.id + ".restarted"); 
                            this.update(obj,callback); 
                        } else {
                            console.log("Subscribed object updated, but running already as "+this._latest_timer_id); 
                        }
                    })
                });
            }


            callback();
        },

        // mxui.widget._WidgetBase.enable is called when the widget should enable editing. Implement to enable editing if widget is input widget.
        enable: function () {

        },

        // mxui.widget._WidgetBase.enable is called when the widget should disable editing. Implement to disable editing if widget is input widget.
        disable: function () {

        },

        // mxui.widget._WidgetBase.resize is called when the page's layout is recalculated. Implement to do sizing calculations. Prefer using CSS instead.
        resize: function (box) {

        },

        // mxui.widget._WidgetBase.uninitialize is called when the widget is destroyed. Implement to do special tear-down work.
        uninitialize: function () {
            // Clean up listeners, helper objects, etc. There is no need to remove listeners added with this.connect / this.subscribe / this.own.
            this._stopTimer();
        },

        _runTimer: function () {
            console.log(this.id + '._runTimer', this.timeout);
            if (this.microflow !== "" && this._contextObj) {
                //The microflow shouldn't repeat:   1) Run once (run only)
                //                                  2) Run once with delay (timeout only)
                //The microflow should repeat:      3) Start at once and run on interval (run and interval)
                //                                  4) Start at once and run on callback (run only) 
                //                                  5) Run on interval start with delay (interval only)
                //                                  6) Run on callback start with delay (timeout only)

                if (this.execute_once && this.start_at_once) {
                    this._execMf([this._contextObj.getGuid()], this.microflow); //1
                } else if (this.execute_once && !this.start_at_once) {
                    this._latest_timer_id = window.setTimeout(lang.hitch(this, this._execMf), this.timeout);  //2
                    this._timer_running = true;
                } else if (!this.execute_once && this.start_at_once && !this.repeat_on_callback) {
                    this._execMf([this._contextObj.getGuid()], this.microflow); //3a
                    this._latest_timer_id = window.setInterval(lang.hitch(this, this._execMf), this.timeout);  //3b
                    this._timer_running = true;
                } else if (!this.execute_once && this.start_at_once && this.repeat_on_callback) {
                    this._execMf([this._contextObj.getGuid()], this.microflow); //4
                } else if (!this.execute_once && !this.start_at_once && !this.repeat_on_callback) {
                    this._latest_timer_id = window.setInterval(lang.hitch(this, this._execMf), this.timeout);  //5
                    this._timer_running = true;
                } else if (!this.execute_once && !this.start_at_once && this.repeat_on_callback) {
                    this._latest_timer_id = window.setTimeout(lang.hitch(this, this._execMf), this.timeout);  //6
                    this._timer_running = true;
                }
            }
        },

        _stopTimer: function () {
            console.log(this.id + '._stopTimer');            
            if (this._timer_running) {
                if (this.execute_once || this.repeat_on_callback) { //Situation 2 or 6: timeout
                    window.clearTimeout(this._latest_timer_id);
                } else {
                    window.clearInterval(this._latest_timer_id);
                }
                this.repeat_on_callback = false; //prevent repeat on callback
                this._latest_timer_id = null;
                this._timer_running = false;
            }
        },

        _execMf: function () { 
            console.log(this.id + '._execMf');
            
            var self = this,
                guids = [this._contextObj.getGuid()],
                mf = this.microflow;
                mx.data.action({
                    params: {
                        applyto: "selection",
                        actionname: mf,
                        guids: guids
                    },
                    callback: function (result) {
                        //Run callback_js
                        try {
                            eval(self.callback_js);
                        } catch (e) {
                            console.log("Error while evaluating JavaScript: " + e);
                        }
                        
                        
                        if (!result && !self.repeat_on_callback) { //Microflow returned false and running on interval: stop timer, set running=false
                            self._stopTimer();
                            self._timer_running = false;
                        } else if (result && !self.repeat_on_callback) {  //Microflow returned true and running on interval: continue timer, set running=true
                            self._timer_running = true;
                        } else if (result && self.repeat_on_callback) {  //Microflow returned true and running on callback: set timeout, set running=true
                            self._latest_timer_id = window.setTimeout(lang.hitch(self, self._execMf), self.timeout);
                            self._timer_running = true;
                        } else if (!result && self.repeat_on_callback) {  //Microflow returned false and running on callback: do nothing, set running=false
                            self._timer_running = false;
                        }
                    },
                    error: function (error) {
                        console.warn('Error executing mf: ', error);
                        if (self.repeat_on_callback) { //When error occurs, timer is deactivated
                            self._timer_running = false;
                        }
                    }
                });
        }
    });
});
