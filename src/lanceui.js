/**
 * @license Copyright (c) 2003-2018, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

/**
 * @module lance/lanceui
 */

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import ClickObserver from '@ckeditor/ckeditor5-engine/src/view/observer/clickobserver';
import Range from '@ckeditor/ckeditor5-engine/src/view/range';
import { isCommentElement } from './utils';
import ContextualBalloon from '@ckeditor/ckeditor5-ui/src/panel/balloon/contextualballoon';

import clickOutsideHandler from '@ckeditor/ckeditor5-ui/src/bindings/clickoutsidehandler';

import ButtonView from '@ckeditor/ckeditor5-ui/src/button/buttonview';
import LanceFormView from './ui/lanceformview';
import LanceActionsView from './ui/lanceactionsview';

import lanceIcon from '../theme/icons/lance.svg';

const lanceKeystroke = 'Ctrl+L';

/**
 * The lance UI plugin. It introduces the `'lance'` and `'unlance'` buttons and support for the <kbd>Ctrl+L</kbd> keystroke.
 *
 * It uses the
 * {@link module:ui/panel/balloon/contextualballoon~ContextualBalloon contextual balloon plugin}.
 *
 * @extends module:core/plugin~Plugin
 */
export default class LanceUI extends Plugin {
	/**
	 * @inheritDoc
	 */
	static get requires() {
		return [ ContextualBalloon ];
	}

	/**
	 * @inheritDoc
	 */
	init() {
		const editor = this.editor;

		editor.editing.view.addObserver( ClickObserver );

		/**
		 * The actions view displayed inside of the balloon.
		 *
		 * @member {module:lance/ui/lanceactionsview~LanceActionsView}
		 */
		this.actionsView = this._createActionsView();

		/**
		 * The form view displayed inside the balloon.
		 *
		 * @member {module:lance/ui/lanceformview~LanceFormView}
		 */
		this.formView = this._createFormView();

		/**
		 * The contextual balloon plugin instance.
		 *
		 * @private
		 * @member {module:ui/panel/balloon/contextualballoon~ContextualBalloon}
		 */
		this._balloon = editor.plugins.get( ContextualBalloon );

		// Create toolbar buttons.
		this._createToolbarLanceButton();

		// Attach lifecycle actions to the the balloon.
		this._enableUserBalloonInteractions();
	}

	/**
	 * Creates the {@link module:lance/ui/lanceactionsview~LanceActionsView} instance.
	 *
	 * @private
	 * @returns {module:link/ui/lanceactionsview~LanceActionsView} The lance actions view instance.
	 */
	_createActionsView() {
		const editor = this.editor;
		const actionsView = new LanceActionsView( editor.locale );
		const lanceCommand = editor.commands.get( 'lance' );
		const unlanceCommand = editor.commands.get( 'unlance' );

		actionsView.bind( 'href' ).to( lanceCommand, 'value' );
		actionsView.editButtonView.bind( 'isEnabled' ).to( lanceCommand );
		actionsView.unlanceButtonView.bind( 'isEnabled' ).to( unlanceCommand );

		// Execute unlance command after clicking on the "Edit" button.
		this.listenTo( actionsView, 'edit', () => {
			this._addFormView();
		} );

		// Execute unlance command after clicking on the "Unlance" button.
		this.listenTo( actionsView, 'unlance', () => {
			editor.execute( 'unlance' );
			this._hideUI();
		} );

		// Close the panel on esc key press when the **actions have focus**.
		actionsView.keystrokes.set( 'Esc', ( data, cancel ) => {
			this._hideUI();
			cancel();
		} );

		// Open the form view on Ctrl+L when the **actions have focus**..
		actionsView.keystrokes.set( lanceKeystroke, ( data, cancel ) => {
			this._addFormView();
			cancel();
		} );

		return actionsView;
	}

	/**
	 * Creates the {@link module:lance/ui/lanceformview~LanceFormView} instance.
	 *
	 * @private
	 * @returns {module:lance/ui/lanceformview~LanceFormView} The lance form instance.
	 */
	_createFormView() {
		const editor = this.editor;
		const formView = new LanceFormView( editor.locale );
		const lanceCommand = editor.commands.get( 'lance' );

		formView.urlInputView.bind( 'value' ).to( lanceCommand, 'value' );

		// Form elements should be read-only when corresponding commands are disabled.
		formView.urlInputView.bind( 'isReadOnly' ).to( lanceCommand, 'isEnabled', value => !value );
		formView.saveButtonView.bind( 'isEnabled' ).to( lanceCommand );

		// Execute lance command after clicking the "Save" button.
		this.listenTo( formView, 'submit', () => {
			editor.execute( 'lance', formView.urlInputView.inputView.element.value );
			this._removeFormView();
		} );

		// Hide the panel after clicking the "Cancel" button.
		this.listenTo( formView, 'cancel', () => {
			this._removeFormView();
		} );

		// Close the panel on esc key press when the **form has focus**.
		formView.keystrokes.set( 'Esc', ( data, cancel ) => {
			this._removeFormView();
			cancel();
		} );

		return formView;
	}

	/**
	 * Creates a toolbar Lance button. Clicking this button will show
	 * a {@link #_balloon} attached to the selection.
	 *
	 * @private
	 */
	_createToolbarLanceButton() {
		const editor = this.editor;
		const lanceCommand = editor.commands.get( 'lance' );
		const t = editor.t;

		// Handle the `Ctrl+L` keystroke and show the panel.
		editor.keystrokes.set( lanceKeystroke, ( keyEvtData, cancel ) => {
			// TODO:[dvs] check if needed - probably not?!
			// Prevent focusing the search bar in FF and opening new tab in Edge. #153, #154.
			cancel();

			if ( lanceCommand.isEnabled ) {
				this._showUI();
			}
		} );

		editor.ui.componentFactory.add( 'lance', locale => {
			const button = new ButtonView( locale );

			button.isEnabled = true;
			button.label = t( 'Add Comment' );
			button.icon = lanceIcon;
			button.keystroke = lanceKeystroke;
			button.tooltip = true;

			// Bind button to the command.
			button.bind( 'isOn', 'isEnabled' ).to( lanceCommand, 'value', 'isEnabled' );

			// Show the panel on button click.
			this.listenTo( button, 'execute', () => this._showUI() );

			return button;
		} );
	}

	/**
	 * Attaches actions that control whether the balloon panel containing the
	 * {@link #formView} is visible or not.
	 *
	 * @private
	 */
	_enableUserBalloonInteractions() {
		const viewDocument = this.editor.editing.view.document;

		// Handle click on view document and show panel when selection is placed inside the lance element.
		// Keep panel open until selection will be inside the same lance element.
		this.listenTo( viewDocument, 'click', () => {
			const parentLance = this._getSelectedCommentElement();

			if ( parentLance ) {
				// Then show panel but keep focus inside editor editable.
				this._showUI();
			}
		} );

		// Focus the form if the balloon is visible and the Tab key has been pressed.
		this.editor.keystrokes.set( 'Tab', ( data, cancel ) => {
			if ( this._areActionsVisible && !this.actionsView.focusTracker.isFocused ) {
				this.actionsView.focus();
				cancel();
			}
		}, {
			// TODO:[dvs] check the following...
			// Use the high priority because the link UI navigation is more important
			// than other feature's actions, e.g. list indentation.
			// https://github.com/ckeditor/ckeditor5-link/issues/146
			priority: 'high'
		} );

		// Close the panel on the Esc key press when the editable has focus and the balloon is visible.
		this.editor.keystrokes.set( 'Esc', ( data, cancel ) => {
			if ( this._isUIVisible ) {
				this._hideUI();
				cancel();
			}
		} );

		// Close on click outside of balloon panel element.
		clickOutsideHandler( {
			emitter: this.formView,
			activator: () => this._isUIVisible,
			contextElements: [ this._balloon.view.element ],
			callback: () => this._hideUI()
		} );
	}

	/**
	 * Adds the {@link #actionsView} to the {@link #_balloon}.
	 *
	 * @protected
	 */
	_addActionsView() {
		if ( this._areActionsInPanel ) {
			return;
		}

		this._balloon.add( {
			view: this.actionsView,
			position: this._getBalloonPositionData()
		} );
	}

	/**
	 * Adds the {@link #formView} to the {@link #_balloon}.
	 *
	 * @protected
	 */
	_addFormView() {
		if ( this._isFormInPanel ) {
			return;
		}

		const editor = this.editor;
		const lanceCommand = editor.commands.get( 'lance' );

		this._balloon.add( {
			view: this.formView,
			position: this._getBalloonPositionData()
		} );

		this.formView.urlInputView.select();

		// TODO:[dvs] ...
		// Make sure that each time the panel shows up, the URL field remains in sync with the value of
		// the command. If the user typed in the input, then canceled the balloon (`urlInputView#value` stays
		// unaltered) and re-opened it without changing the value of the link command (e.g. because they
		// clicked the same link), they would see the old value instead of the actual value of the command.
		// https://github.com/ckeditor/ckeditor5-link/issues/78
		// https://github.com/ckeditor/ckeditor5-link/issues/123
		this.formView.urlInputView.inputView.element.value = lanceCommand.value || '';
	}

	/**
	 * Removes the {@link #formView} from the {@link #_balloon}.
	 *
	 * @protected
	 */
	_removeFormView() {
		if ( this._isFormInPanel ) {
			this._balloon.remove( this.formView );

			// Because the form has an input which has focus, the focus must be brought back
			// to the editor. Otherwise, it would be lost.
			this.editor.editing.view.focus();
		}
	}

	/**
	 * Shows the right kind of the UI for current state of the command. It's either
	 * {@link #formView} or {@link #actionsView}.
	 *
	 * @private
	 */
	_showUI() {
		const editor = this.editor;
		const lanceCommand = editor.commands.get( 'lance' );

		if ( !lanceCommand.isEnabled ) {
			return;
		}

		// When there's no comment under the selection, go straight to the editing UI.
		if ( !this._getSelectedCommentElement() ) {
			this._addActionsView();
			this._addFormView();
		}
		// If theres a comment under the selection...
		else {
			// Go to the editing UI if actions are already visible.
			if ( this._areActionsVisible ) {
				this._addFormView();
			}
			// Otherwise display just the actions UI.
			else {
				this._addActionsView();
			}
		}

		// Begin responding to ui#update once the UI is added.
		this._startUpdatingUI();
	}

	/**
	 * Removes the {@link #formView} from the {@link #_balloon}.
	 *
	 * See {@link #_addFormView}, {@link #_addActionsView}.
	 *
	 * @protected
	 */
	_hideUI() {
		if ( !this._isUIInPanel ) {
			return;
		}

		const editor = this.editor;

		this.stopListening( editor.ui, 'update' );

		// Remove form first because it's on top of the stack.
		this._removeFormView();

		// Then remove the actions view because it's beneath the form.
		this._balloon.remove( this.actionsView );

		// Make sure the focus always gets back to the editable.
		editor.editing.view.focus();
	}

	/**
	 * Makes the UI react to the {@link module:core/editor/editorui~EditorUI#event:update} event to
	 * reposition itself when the editor ui should be refreshed.
	 *
	 * See: {@link #_hideUI} to learn when the UI stops reacting to the `update` event.
	 *
	 * @protected
	 */
	_startUpdatingUI() {
		const editor = this.editor;
		const viewDocument = editor.editing.view.document;

		let prevSelectedComment = this._getSelectedCommentElement();
		let prevSelectionParent = getSelectionParent();

		this.listenTo( editor.ui, 'update', () => {
			const selectedComment = this._getSelectedCommentElement();
			const selectionParent = getSelectionParent();

			// TODO:[dvs] ...
			// Hide the panel if:
			//
			// * the selection went out of the EXISTING link element. E.g. user moved the caret out
			//   of the link,
			// * the selection went to a different parent when creating a NEW link. E.g. someone
			//   else modified the document.
			// * the selection has expanded (e.g. displaying link actions then pressing SHIFT+Right arrow).
			//
			// Note: #_getSelectedLinkElement will return a link for a non-collapsed selection only
			// when fully selected.
			if ( ( prevSelectedComment && !selectedComment ) ||
				( !prevSelectedComment && selectionParent !== prevSelectionParent ) ) {
				this._hideUI();
			}
			// Update the position of the panel when:
			//  * the selection remains in the original link element,
			//  * there was no link element in the first place, i.e. creating a new link
			else {
				// If still in a link element, simply update the position of the balloon.
				// If there was no link (e.g. inserting one), the balloon must be moved
				// to the new position in the editing view (a new native DOM range).
				this._balloon.updatePosition( this._getBalloonPositionData() );
			}

			prevSelectedComment = selectedComment;
			prevSelectionParent = selectionParent;
		} );

		function getSelectionParent() {
			return viewDocument.selection.focus.getAncestors()
				.reverse()
				.find( node => node.is( 'element' ) );
		}
	}

	/**
	 * Returns true when {@link #formView} is in the {@link #_balloon}.
	 *
	 * @readonly
	 * @protected
	 * @type {Boolean}
	 */
	get _isFormInPanel() {
		return this._balloon.hasView( this.formView );
	}

	/**
	 * Returns true when {@link #actionsView} is in the {@link #_balloon}.
	 *
	 * @readonly
	 * @protected
	 * @type {Boolean}
	 */
	get _areActionsInPanel() {
		return this._balloon.hasView( this.actionsView );
	}

	/**
	 * Returns true when {@link #actionsView} is in the {@link #_balloon} and it is
	 * currently visible.
	 *
	 * @readonly
	 * @protected
	 * @type {Boolean}
	 */
	get _areActionsVisible() {
		return this._balloon.visibleView === this.actionsView;
	}

	/**
	 * Returns true when {@link #actionsView} or {@link #formView} is in the {@link #_balloon}.
	 *
	 * @readonly
	 * @protected
	 * @type {Boolean}
	 */
	get _isUIInPanel() {
		return this._isFormInPanel || this._areActionsInPanel;
	}

	/**
	 * Returns true when {@link #actionsView} or {@link #formView} is in the {@link #_balloon} and it is
	 * currently visible.
	 *
	 * @readonly
	 * @protected
	 * @type {Boolean}
	 */
	get _isUIVisible() {
		const visibleView = this._balloon.visibleView;

		return visibleView == this.formView || this._areActionsVisible;
	}

	/**
	 * TODO:[dvs] ...
	 * Returns positioning options for the {@link #_balloon}. They control the way the balloon is attached
	 * to the target element or selection.
	 *
	 * If the selection is collapsed and inside a link element, the panel will be attached to the
	 * entire link element. Otherwise, it will be attached to the selection.
	 *
	 * @private
	 * @returns {module:utils/dom/position~Options}
	 */
	_getBalloonPositionData() {
		const view = this.editor.editing.view;
		const viewDocument = view.document;
		const targetComment = this._getSelectedCommentElement();

		const target = targetComment ?
			// When selection is inside comment element, then attach panel to this element.
			view.domConverter.mapViewToDom( targetComment ) :
			// Otherwise attach panel to the selection.
			view.domConverter.viewRangeToDom( viewDocument.selection.getFirstRange() );

		return { target };
	}

	/**
	 * TODO:[dvs] ...
	 * Returns the comment {@link module:engine/view/attributeelement~AttributeElement} under
	 * the {@link module:engine/view/document~Document editing view's} selection or `null`
	 * if there is none.
	 *
	 * **Note**: For a non–collapsed selection the comment element is only returned when **fully**
	 * selected and the **only** element within the selection boundaries.
	 *
	 * @private
	 * @returns {module:engine/view/attributeelement~AttributeElement|null}
	 */
	_getSelectedCommentElement() {
		const selection = this.editor.editing.view.document.selection;

		if ( selection.isCollapsed ) {
			return findCommentElementAncestor( selection.getFirstPosition() );
		} else {
			// The range for fully selected link is usually anchored in adjacent text nodes.
			// Trim it to get closer to the actual link element.
			const range = selection.getFirstRange().getTrimmed();
			const startComment = findCommentElementAncestor( range.start );
			const endComment = findCommentElementAncestor( range.end );

			if ( !startComment || startComment != endComment ) {
				return null;
			}

			// Check if the comment element is fully selected.
			if ( Range.createIn( startComment ).getTrimmed().isEqual( range ) ) {
				return startComment;
			} else {
				return null;
			}
		}
	}
}

// Returns a comment element if there's one among the ancestors of the provided `Position`.
//
// @private
// @param {module:engine/view/position~Position} View position to analyze.
// @returns {module:engine/view/attributeelement~AttributeElement|null} Comment element at the position or null.
function findCommentElementAncestor( position ) {
	return position.getAncestors().find( ancestor => isCommentElement( ancestor ) );
}
