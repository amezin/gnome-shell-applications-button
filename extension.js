const Lang = imports.lang;
const Atk = imports.gi.Atk;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Main = imports.ui.main;
const Overview = imports.ui.overview;
const Panel = imports.ui.panel;
const PanelMenu = imports.ui.panelMenu;

var ApplicationsButton = new Lang.Class({
    Name: 'ApplicationsButton',
    Extends: PanelMenu.Button,

    _init() {
        this.parent(0.0, null, true);
        this.actor.accessible_role = Atk.Role.TOGGLE_BUTTON;

        this.actor.name = 'panelApplications';
        this._label = new St.Label({
            text: "Applications",
            y_align: Clutter.ActorAlign.CENTER
        });
        this.actor.add_actor(this._label);

        this.actor.label_actor = this._label;

        this.actor.connect('captured-event', this._onCapturedEvent.bind(this));
        this.actor.connect_after('key-release-event', this._onKeyRelease.bind(this));

        this._stageKeyPressId = null;
        this._overviewShowingId = Main.overview.connect('showing', this._onOverviewShowing.bind(this));
        this._overviewHidingId = Main.overview.connect('hiding', this._onOverviewHiding.bind(this));

        this._xdndTimeOut = 0;
    },

    _onOverviewShowing() {
        this.actor.add_style_pseudo_class('overview');
        this.actor.add_accessible_state(Atk.StateType.CHECKED);
    },

    _onOverviewHiding() {
        this.actor.remove_style_pseudo_class('overview');
        this.actor.remove_accessible_state(Atk.StateType.CHECKED);

        if (this._stageKeyPressId) {
            global.stage.disconnect(this._stageKeyPressId);
            this._stageKeyPressId = null;
        }
    },

    destroy() {
        if (this._overviewShowingId > 0) {
            Main.overview.disconnect(this._overviewShowingId);
            this._overviewShowingId = 0;
        }
        if (this._overviewHidingId > 0) {
            Main.overview.disconnect(this._overviewHidingId);
            this._overviewHidingId = 0;
        }
        this.parent();
    },

    toggleOverview() {
        if (Main.overview.isDummy)
            return;

        if (Main.overview.visible)
            Main.overview.hide();
        else {
            this._stageKeyPressId = global.stage.connect('key-press-event', this._onStageKeyPress.bind(this));
            Main.overview.viewSelector.showApps();
        }
    },

    _onStageKeyPress(actor, event) {
        if (Main.modalCount > 1)
            return Clutter.EVENT_PROPAGATE;

        if (event.get_key_symbol() == Clutter.Escape) {
            if (this._searchActive)
                this.reset();
            else
                Main.overview.hide();
            return Clutter.EVENT_STOP;
        }
    },

    handleDragOver(source, actor, x, y, time) {
        if (source != Main.xdndHandler)
            return DND.DragMotionResult.CONTINUE;

        if (this._xdndTimeOut != 0)
            Mainloop.source_remove(this._xdndTimeOut);
        this._xdndTimeOut = Mainloop.timeout_add(BUTTON_DND_ACTIVATION_TIMEOUT, () => {
            this._xdndToggleOverview(actor);
        });
        GLib.Source.set_name_by_id(this._xdndTimeOut, '[gnome-shell] this._xdndToggleOverview');

        return DND.DragMotionResult.CONTINUE;
    },

    _onCapturedEvent(actor, event) {
        if (event.type() == Clutter.EventType.BUTTON_PRESS ||
            event.type() == Clutter.EventType.TOUCH_BEGIN) {
            if (!Main.overview.shouldToggleByCornerOrButton())
                return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    },

    _onEvent(actor, event) {
        this.parent(actor, event);

        if (event.type() == Clutter.EventType.TOUCH_END ||
            event.type() == Clutter.EventType.BUTTON_RELEASE)
            if (Main.overview.shouldToggleByCornerOrButton())
                this.toggleOverview();

        return Clutter.EVENT_PROPAGATE;
    },

    _onKeyRelease(actor, event) {
        let symbol = event.get_key_symbol();
        if (symbol == Clutter.KEY_Return || symbol == Clutter.KEY_space) {
            if (Main.overview.shouldToggleByCornerOrButton())
                this.toggleOverview();
        }
        return Clutter.EVENT_PROPAGATE;
    },

    _xdndToggleOverview(actor) {
        let [x, y, mask] = global.get_pointer();
        let pickedActor = global.stage.get_actor_at_pos(Clutter.PickMode.REACTIVE, x, y);

        if (pickedActor == this.actor && Main.overview.shouldToggleByCornerOrButton())
            this.toggleOverview();

        Mainloop.source_remove(this._xdndTimeOut);
        this._xdndTimeOut = 0;
        return GLib.SOURCE_REMOVE;
    }
});

let appsButton;
let activitiesButton;

function enable() {
    activitiesButton = Main.panel.statusArea['activities'];
    activitiesButton.container.hide();
    appsButton = new ApplicationsButton();
    Main.panel.addToStatusArea('apps-button', appsButton, 0, 'left');
}

function disable() {
    appsButton.destroy();
    activitiesButton.container.show();
}

function init() {
}
