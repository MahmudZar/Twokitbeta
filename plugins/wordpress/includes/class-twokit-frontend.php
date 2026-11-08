<?php
/**
 * Closed mode on the site: the two stylesheets, on the front end and in the
 * Bricks builder canvas (which renders the front end). No JavaScript: light
 * and dark come from Bricks' data-brx-theme and the Style manager.
 *
 * Order matters. On the front end TwoKit loads after all of Bricks' CSS
 * (frontend, theme style, variables, post CSS), so a TwoKit class beats a
 * theme-style rule of the same weight (.grid-3 over the theme style's
 * .brxe-div { display: flex }). The builder canvas writes that same CSS as
 * <style> tags inside div.brx-body, after <head>; so in the canvas the files
 * are printed at wp_footer, after those tags, which gives the canvas the
 * front end's order.
 *
 * Bricks 2.4 component thumbnails (admin-ajax) get the two files too.
 *
 * Block editor: TwoKit does exactly what Bricks does with its own styles
 * there. Bricks 2.4 loads its frontend styles, variables, theme styles and
 * component classes into the block editor canvas (handle
 * bricks-frontend-gutenberg), scoped to .block-editor-iframe__html/__body,
 * so Bricks components look right in Gutenberg. In open mode TwoKit's styles
 * are in Bricks and come along by themselves; in closed mode TwoKit adds its
 * two files to that same handle, scoped by Bricks' own scoper. So both modes
 * look the same in the editor, nothing else in wp-admin is touched, and
 * without Bricks nothing loads there. The canvas stays light like the editor
 * around it (see ExportModule.themeStylesheet).
 *
 * Open mode loads nothing; Bricks prints everything itself.
 *
 * @package TwoKit
 */

defined( 'ABSPATH' ) || exit;

/**
 * Stylesheet loading.
 */
final class TwoKit_Frontend {

	/**
	 * Hooks in closed mode only.
	 */
	public static function init() {
		if ( 'closed' !== TwoKit_Store::mode() ) {
			return;
		}
		// Late, so TwoKit loads after Bricks' frontend styles. wp_enqueue_scripts runs on
		// front-end requests only.
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue' ), 20 );
		// Builder canvas: printed at wp_footer, after Bricks' canvas styles.
		add_action( 'wp_footer', array( __CLASS__, 'canvas' ), 1 );
		// Before Bricks (10), which builds the thumbnail from the queued stylesheets.
		add_action( 'wp_ajax_bricks_get_component_preview_html', array( __CLASS__, 'component_preview' ), 1 );
		// After Bricks (priority 10), which enqueues its block editor canvas styles here.
		add_action( 'enqueue_block_assets', array( __CLASS__, 'block_editor' ), 20 );
	}

	/**
	 * Front end: the files in <head>, after Bricks' styles.
	 */
	public static function enqueue() {
		// The builder's main window shows no site content; its canvas loads them in canvas().
		if ( is_admin() || ( function_exists( 'bricks_is_builder' ) && bricks_is_builder() ) ) {
			return;
		}
		self::add();
	}

	/**
	 * Builder canvas: the files after the CSS Bricks writes into the canvas.
	 * Printed right here rather than left to the footer's late styles:
	 * WordPress 6.9+ moves late styles back into <head> on classic themes
	 * (wp_hoist_late_printed_styles), which is where Bricks' CSS beats them.
	 */
	public static function canvas() {
		if ( ! function_exists( 'bricks_is_builder_iframe' ) || ! bricks_is_builder_iframe() ) {
			return;
		}
		self::add();
		wp_styles()->do_items( array( 'twokit-tokens', 'twokit-styles' ) );
	}

	/**
	 * Bricks component thumbnails: Bricks links every queued stylesheet into
	 * the preview document. Files only (the preview takes no inline styles).
	 */
	public static function component_preview() {
		$deps = array();
		foreach ( array( 'tokens', 'styles' ) as $key ) {
			$file = TwoKit_Files::file( $key );
			if ( $file ) {
				wp_enqueue_style( 'twokit-' . $key, $file['url'], $deps, $file['version'] );
				$deps = array( 'twokit-' . $key );
			}
		}
	}

	/**
	 * Enqueues the files, or prints the CSS inline when they can't be written.
	 */
	private static function add() {
		$deps = wp_style_is( 'bricks-frontend', 'registered' ) ? array( 'bricks-frontend' ) : array();
		foreach ( array( 'tokens', 'styles' ) as $key ) {
			$handle = 'twokit-' . $key;
			$file   = TwoKit_Files::file( $key );
			if ( $file ) {
				wp_enqueue_style( $handle, $file['url'], $deps, $file['version'] );
			} else {
				$css = TwoKit_Files::backup( $key );
				if ( '' === $css ) {
					continue;
				}
				wp_register_style( $handle, false, $deps, TWOKIT_VERSION );
				wp_enqueue_style( $handle );
				wp_add_inline_style( $handle, $css );
			}
			$deps = array( $handle );
		}
	}

	/**
	 * Block editor canvas: TwoKit's CSS joins Bricks' own editor styles, scoped
	 * the way Bricks scopes them. Only where Bricks loaded those styles (the
	 * post block editor with Bricks active); everywhere else in wp-admin,
	 * nothing.
	 */
	public static function block_editor() {
		if ( ! is_admin() || ! wp_style_is( 'bricks-frontend-gutenberg', 'enqueued' )
			|| ! class_exists( '\Bricks\Integrations\Block_Editor' )
			|| ! method_exists( '\Bricks\Integrations\Block_Editor', 'scope_css_for_gutenberg' ) ) {
			return;
		}
		$css = trim( TwoKit_Files::backup( 'tokens' ) . "\n" . TwoKit_Files::backup( 'styles' ) );
		if ( '' === $css ) {
			return;
		}
		wp_add_inline_style( 'bricks-frontend-gutenberg', \Bricks\Integrations\Block_Editor::scope_css_for_gutenberg( $css ) );
	}
}
