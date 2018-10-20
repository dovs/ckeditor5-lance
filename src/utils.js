/**
 * @license Copyright (c) 2003-2018, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

/**
 * @module lance/utils
 */

const commentElementSymbol = Symbol( 'commentElement' );

const ATTRIBUTE_WHITESPACES = /[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205f\u3000]/g; // eslint-disable-line no-control-regex
const SAFE_URL = /^(?:(?:https?|ftps?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i;

/**
 * Returns `true` if a given view node is the comment element.
 *
 * @param {module:engine/view/node~Node} node
 * @returns {Boolean}
 */
export function isCommentElement( node ) {
	return node.is( 'attributeElement' ) && !!node.getCustomProperty( commentElementSymbol );
}

/**
 * Creates comment {@link module:engine/view/attributeelement~AttributeElement} with provided `href` attribute.
 *
 * @param {String} href
 * @returns {module:engine/view/attributeelement~AttributeElement}
 */
export function createCommentElement( href, writer ) {
	// TODO:[dvs] ...
	// Priority 5 - https://github.com/ckeditor/ckeditor5-link/issues/121.
	const commentElement = writer.createAttributeElement( 'a', { href }, { priority: 5 } );
	writer.setCustomProperty( commentElementSymbol, true, commentElement );

	return commentElement;
}

/**
 * Returns a safe URL based on a given value.
 *
 * An URL is considered safe if it is safe for the user (does not contain any malicious code).
 *
 * If URL is considered unsafe, a simple `"#"` is returned.
 *
 * @protected
 * @param {*} url
 * @returns {String} Safe URL.
 */
export function ensureSafeUrl( url ) {
	url = String( url );

	return isSafeUrl( url ) ? url : '#';
}

// Checks whether the given URL is safe for the user (does not contain any malicious code).
//
// @param {String} url URL to check.
function isSafeUrl( url ) {
	const normalizedUrl = url.replace( ATTRIBUTE_WHITESPACES, '' );

	return normalizedUrl.match( SAFE_URL );
}
