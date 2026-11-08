<?php
/**
 * Options TwoKit owns. Nothing else is stored in the database by TwoKit itself.
 *
 *   twokit_settings  mode ('' until setup, 'closed' or 'open'), files version
 *   twokit_project   the project JSON (the same file the web app exports)
 *   twokit_bricks    ids of everything TwoKit wrote into Bricks, so it can
 *                    update, lock, unlock and remove only its own items
 *   twokit_picker    variable names + swatch colors for the builder's
 *                    variable picker (TwoKit_Picker)
 *
 * @package TwoKit
 */

defined( 'ABSPATH' ) || exit;

/**
 * Option access.
 */
final class TwoKit_Store {

	const SETTINGS = 'twokit_settings';
	const PROJECT  = 'twokit_project';
	const BRICKS   = 'twokit_bricks';

	/**
	 * Largest project accepted (bytes). A project is JSON text; fonts are not inside it.
	 */
	const MAX_PROJECT = 2097152;

	/**
	 * Storage mode: '', 'closed' or 'open'.
	 *
	 * @return string
	 */
	public static function mode() {
		$settings = get_option( self::SETTINGS, array() );
		$mode     = is_array( $settings ) && isset( $settings['mode'] ) ? (string) $settings['mode'] : '';
		return in_array( $mode, array( 'closed', 'open' ), true ) ? $mode : '';
	}

	/**
	 * Saves the storage mode.
	 *
	 * @param string $mode 'closed' or 'open'.
	 */
	public static function set_mode( $mode ) {
		$settings         = get_option( self::SETTINGS, array() );
		$settings         = is_array( $settings ) ? $settings : array();
		$settings['mode'] = $mode;
		update_option( self::SETTINGS, $settings, true );
	}

	/**
	 * The TwoKit version whose app wrote the site's CSS (last successful save),
	 * or '' before the first save. The CSS is built by the app at save time, so
	 * after an update the site keeps the old CSS until the next save.
	 *
	 * @return string
	 */
	public static function built() {
		$settings = get_option( self::SETTINGS, array() );
		return is_array( $settings ) && isset( $settings['built'] ) ? (string) $settings['built'] : '';
	}

	/**
	 * Records that this version's app wrote the site's CSS.
	 */
	public static function set_built() {
		$settings          = get_option( self::SETTINGS, array() );
		$settings          = is_array( $settings ) ? $settings : array();
		$settings['built'] = TWOKIT_VERSION;
		update_option( self::SETTINGS, $settings, true );
	}

	/**
	 * The project JSON text, or '' before the first save.
	 *
	 * @return string
	 */
	public static function project() {
		$project = get_option( self::PROJECT, '' );
		return is_string( $project ) ? $project : '';
	}

	/**
	 * Saves the project JSON text (already validated by the REST layer).
	 *
	 * @param string $json Project JSON.
	 */
	public static function set_project( $json ) {
		update_option( self::PROJECT, $json, false );
	}

	/**
	 * What TwoKit wrote into Bricks last time.
	 *
	 * @return array{classes: string[], variables: string[], classCategories: string[], variableCategories: string[], fonts: string[], themeStyle: string, palette: string}
	 */
	public static function bricks() {
		$data = get_option( self::BRICKS, array() );
		$data = is_array( $data ) ? $data : array();
		return array(
			'classes'            => self::ids( $data['classes'] ?? array() ),
			'variables'          => self::ids( $data['variables'] ?? array() ),
			'classCategories'    => self::ids( $data['classCategories'] ?? array() ),
			'variableCategories' => self::ids( $data['variableCategories'] ?? array() ),
			'fonts'              => array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $data['fonts'] ?? array() ) ) ) ),
			// Post ids of TwoKit's own fonts in Bricks' font library (1.0.22+): only these
			// are updated and removed, never a site's own font with the same family name.
			'fontPosts'          => array_values( array_unique( array_filter( array_map( 'absint', (array) ( $data['fontPosts'] ?? array() ) ) ) ) ),
			// Hash of the font files last imported: unchanged fonts aren't sent again.
			'fontsHash'          => self::hash( $data['fontsHash'] ?? '' ),
			'themeStyle'         => self::id( $data['themeStyle'] ?? '' ),
			'palette'            => self::id( $data['palette'] ?? '' ),
		);
	}

	/**
	 * A hex hash (16–64 characters), or ''.
	 *
	 * @param mixed $value Raw hash.
	 * @return string
	 */
	public static function hash( $value ) {
		$value = is_scalar( $value ) ? strtolower( (string) $value ) : '';
		return preg_match( '/^[a-f0-9]{16,64}$/', $value ) ? $value : '';
	}

	/**
	 * Saves what TwoKit wrote into Bricks.
	 *
	 * @param array $data See bricks().
	 */
	public static function set_bricks( $data ) {
		update_option( self::BRICKS, $data, false );
	}

	/**
	 * A Bricks id (letters, digits, '-', '_', ':'), or ''.
	 *
	 * @param mixed $value Raw id.
	 * @return string
	 */
	public static function id( $value ) {
		$value = is_scalar( $value ) ? (string) $value : '';
		return preg_match( '/^[A-Za-z0-9_:-]{1,64}$/', $value ) ? $value : '';
	}

	/**
	 * A list of Bricks ids.
	 *
	 * @param mixed $values Raw ids.
	 * @return string[]
	 */
	public static function ids( $values ) {
		return array_values( array_unique( array_filter( array_map( array( __CLASS__, 'id' ), (array) $values ) ) ) );
	}

	/**
	 * Removes every option TwoKit created (uninstall).
	 */
	public static function delete_all() {
		delete_option( self::SETTINGS );
		delete_option( self::PROJECT );
		delete_option( self::BRICKS );
		delete_option( TwoKit_Files::BACKUP );
		// The builder picker's catalog (TwoKit_Picker::OPTION; that class isn't loaded on uninstall).
		delete_option( 'twokit_picker' );
	}
}
