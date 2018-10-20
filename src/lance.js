/**
 * @license Copyright (c) 2003-2018, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

/**
 * @module lance/lance
 */

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import LanceEditing from './lanceediting';
import LanceUI from './lanceui';

/**
 * The lance plugin.
 *
 * This is a "glue" plugin which loads the {@link module:lance/lanceediting~LanceEditing lance editing feature}
 * and {@link module:lance/lanceui~LanceUI lance UI feature}.
 *
 * @extends module:core/plugin~Plugin
 */
export default class Lance extends Plugin {
	/**
	 * @inheritDoc
	 */
	static get requires() {
		return [ LanceEditing, LanceUI ];
	}

	/**
	 * @inheritDoc
	 */
	static get pluginName() {
		return 'Lance';
	}
}
