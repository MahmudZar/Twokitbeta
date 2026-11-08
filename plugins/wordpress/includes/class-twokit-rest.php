<?php
/**
 * Three REST routes, all POST, all for the admin app only:
 *
 *   /twokit/v1/save    store the project and apply it
 *   /twokit/v1/reset   remove everything TwoKit added to the site
 *   /twokit/v1/status  read-only: Bricks' Style manager mode, so the app
 *                      follows a change made in Bricks while it's open
 *
 * Who: administrators who may edit site CSS (manage_options + core's edit_css,
 * the capability behind Additional CSS; on multisite it needs unfiltered_html),
 * with a valid REST nonce (X-WP-Nonce), checked explicitly as well as by
 * WordPress' cookie authentication. Nothing is public: no GET routes, no keys,
 * the routes are left out of the REST index, and request bodies are size
 * capped before they are decoded.
 *
 * What: the project JSON, the storage mode, closed mode's two minified
 * stylesheets and, with Bricks, the global-data zip for Bricks' importer.
 * Every field is checked before anything is written.
 *
 * @package TwoKit
 */

defined( 'ABSPATH' ) || exit;

/**
 * REST API.
 */
final class TwoKit_Rest {

	const NAMESPACE = 'twokit/v1';

	/**
	 * Largest zip accepted (base64 characters, about 30 MB of fonts).
	 */
	const MAX_ZIP = 41943040;

	/**
	 * Largest request body (bytes): the zip plus project and CSS.
	 */
	const MAX_BODY = 48234496;

	/**
	 * Registers the routes.
	 */
	public static function register() {
		foreach ( array( 'save', 'reset', 'status' ) as $route ) {
			register_rest_route(
				self::NAMESPACE,
				'/' . $route,
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( __CLASS__, $route ),
					'permission_callback' => array( __CLASS__, 'permission' ),
					'show_in_index'       => false,
				)
			);
		}
	}

	/**
	 * Only administrators who can edit site CSS.
	 *
	 * @return bool
	 */
	public static function can_save() {
		return current_user_can( 'manage_options' ) && current_user_can( 'edit_css' );
	}

	/**
	 * Permission for both routes: the capabilities, and the REST nonce.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return bool|WP_Error
	 */
	public static function permission( WP_REST_Request $request ) {
		if ( ! wp_verify_nonce( (string) $request->get_header( 'X-WP-Nonce' ), 'wp_rest' ) ) {
			return new WP_Error( 'rest_cookie_invalid_nonce', __( 'Your login session expired. Reload the page and try again.', 'twokit' ), array( 'status' => 403 ) );
		}
		return self::can_save();
	}

	/**
	 * The JSON body, or an error when it's too large or not JSON.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return array|WP_Error
	 */
	private static function body( WP_REST_Request $request ) {
		// Saves send multipart/form-data: the JSON in `payload`, the Bricks zip as a
		// file, which PHP streams to a temporary file instead of holding it in memory
		// (base64 inside JSON was held three times). A JSON body still works.
		$files = $request->get_file_params();
		$form  = $request->get_body_params();
		if ( isset( $form['payload'] ) && is_string( $form['payload'] ) ) {
			if ( strlen( $form['payload'] ) > self::MAX_BODY ) {
				return self::error( __( 'The upload is too large.', 'twokit' ), 413 );
			}
			// WordPress' REST server has already unslashed the form fields.
			$body = json_decode( $form['payload'], true, 512 );
			if ( ! is_array( $body ) ) {
				return self::error( __( 'Expected a JSON body.', 'twokit' ) );
			}
			// The zip only ever comes from the upload itself, never from the JSON.
			if ( isset( $body['bricks'] ) && is_array( $body['bricks'] ) ) {
				unset( $body['bricks']['zipFile'] );
				if ( isset( $files['bricks_zip'] ) && is_array( $files['bricks_zip'] ) ) {
					$body['bricks']['zipFile'] = $files['bricks_zip'];
				}
			}
			return $body;
		}
		if ( strlen( $request->get_body() ) > self::MAX_BODY ) {
			return self::error( __( 'The upload is too large.', 'twokit' ), 413 );
		}
		$body = $request->get_json_params();
		if ( is_array( $body ) && isset( $body['bricks'] ) && is_array( $body['bricks'] ) ) {
			unset( $body['bricks']['zipFile'] );
		}
		return is_array( $body ) ? $body : self::error( __( 'Expected a JSON body.', 'twokit' ) );
	}

	/**
	 * The Bricks zip bytes from a save: the uploaded file, or base64 in the
	 * JSON (older apps). WP_Error when missing, too large or not a zip.
	 *
	 * @param array $raw Raw `bricks` field.
	 * @return string|WP_Error
	 */
	private static function zip_bytes( array $raw ) {
		$max_bytes = (int) ( self::MAX_ZIP / 4 * 3 );
		if ( isset( $raw['zipFile'] ) && is_array( $raw['zipFile'] ) ) {
			$file = $raw['zipFile'];
			$tmp  = isset( $file['tmp_name'] ) && is_string( $file['tmp_name'] ) ? $file['tmp_name'] : '';
			if ( ( $file['error'] ?? UPLOAD_ERR_NO_FILE ) !== UPLOAD_ERR_OK || '' === $tmp || ! is_uploaded_file( $tmp ) ) {
				return self::error( __( 'The Bricks package did not arrive. Try again.', 'twokit' ) );
			}
			if ( (int) ( $file['size'] ?? 0 ) > $max_bytes || filesize( $tmp ) > $max_bytes ) {
				return self::error( __( 'The Bricks package is missing or too large.', 'twokit' ) );
			}
			$bytes = file_get_contents( $tmp ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- an uploaded temp file.
		} else {
			$zip = isset( $raw['zip'] ) && is_string( $raw['zip'] ) ? $raw['zip'] : '';
			if ( '' === $zip || strlen( $zip ) > self::MAX_ZIP ) {
				return self::error( __( 'The Bricks package is missing or too large.', 'twokit' ) );
			}
			$bytes = base64_decode( $zip, true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode -- binary zip sent as JSON.
		}
		if ( ! is_string( $bytes ) || 0 !== strpos( $bytes, "PK\x03\x04" ) ) {
			return self::error( __( 'The Bricks package is not a zip file.', 'twokit' ) );
		}
		return $bytes;
	}

	/**
	 * Removes everything TwoKit added to the site (Project → Remove TwoKit from
	 * this site): its CSS files, its classes, variables, categories, palette,
	 * theme style and fonts in Bricks, and its saved project and settings. The
	 * next visit starts with setup. Only items TwoKit recorded (or its stable
	 * ids sent by the app) are touched.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function reset( WP_REST_Request $request ) {
		$body = self::body( $request );
		if ( is_wp_error( $body ) ) {
			return $body;
		}
		if ( ( $body['confirm'] ?? '' ) !== 'remove-twokit' ) {
			return self::error( __( 'Removal was not confirmed.', 'twokit' ) );
		}
		// Variables and theme style by their stable ids too, in case tracking was lost.
		TwoKit_Bricks::remove_variables( TwoKit_Store::ids( $body['variables'] ?? array() ) );
		TwoKit_Bricks::remove_all( TwoKit_Store::id( $body['themeStyle'] ?? '' ) );
		TwoKit_Files::delete_all();
		TwoKit_Store::delete_all();

		return new WP_REST_Response( array( 'message' => __( 'TwoKit removed from this site', 'twokit' ) ), 200 );
	}

	/**
	 * What the app needs to stay in step with Bricks: the Style manager's
	 * default mode (the theme's default mode). Reads one option, writes nothing.
	 *
	 * @return WP_REST_Response
	 */
	public static function status() {
		return new WP_REST_Response(
			array(
				'bricksMode' => TwoKit_Bricks::active() ? TwoKit_Bricks::current_mode() : '',
				// Where the styles are now ('closed', 'open' or '' before setup).
				'mode'       => TwoKit_Store::mode(),
			),
			200
		);
	}

	/**
	 * Saves the project and applies it.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function save( WP_REST_Request $request ) {
		// Font-heavy saves: the admin memory limit, as WordPress uses for uploads.
		wp_raise_memory_limit( 'admin' );
		$body = self::body( $request );
		if ( is_wp_error( $body ) ) {
			return $body;
		}

		// Mode.
		$mode = isset( $body['mode'] ) ? (string) $body['mode'] : '';
		if ( ! in_array( $mode, array( 'closed', 'open' ), true ) ) {
			return self::error( __( 'Unknown storage mode.', 'twokit' ) );
		}
		$bricks_active = TwoKit_Bricks::active();
		if ( 'open' === $mode && ! $bricks_active ) {
			/* translators: %s: minimum Bricks version. */
			return self::error( sprintf( __( 'Saved in Bricks needs Bricks %s or newer as the active theme.', 'twokit' ), TwoKit_Bricks::MIN_VERSION ) );
		}

		// Project.
		$project = isset( $body['project'] ) && is_string( $body['project'] ) ? $body['project'] : '';
		if ( '' === $project || strlen( $project ) > TwoKit_Store::MAX_PROJECT ) {
			return self::error( __( 'The project is missing or too large.', 'twokit' ) );
		}
		$decoded = json_decode( $project, true, 64 );
		if ( null === $decoded && JSON_ERROR_NONE !== json_last_error() ) {
			/* translators: %s: JSON error, e.g. "Maximum stack depth exceeded". */
			return self::error( sprintf( __( 'The project could not be read (%s).', 'twokit' ), json_last_error_msg() ) );
		}
		if ( ! is_array( $decoded ) || ( $decoded['$schema'] ?? '' ) !== 'twokit/project' || ! isset( $decoded['state'] ) || ! is_array( $decoded['state'] ) ) {
			return self::error( __( 'This is not a TwoKit project.', 'twokit' ) );
		}

		$default_mode = isset( $body['defaultMode'] ) ? (string) $body['defaultMode'] : 'light';
		$default_mode = in_array( $default_mode, array( 'light', 'dark', 'auto' ), true ) ? $default_mode : 'light';

		// The theme mode is also Bricks' Style manager default mode, which can be changed
		// in Bricks while TwoKit is open. If it changed there since the app loaded it
		// (bricksMode) and the app didn't change it, Bricks' choice wins and is kept in
		// the project too.
		$bricks_mode = $bricks_active ? TwoKit_Bricks::current_mode() : '';
		$loaded_mode = isset( $body['bricksMode'] ) ? (string) $body['bricksMode'] : '';
		if ( '' !== $bricks_mode && '' !== $loaded_mode && $bricks_mode !== $loaded_mode && $default_mode === $loaded_mode ) {
			$default_mode = $bricks_mode;
			if ( isset( $decoded['state']['theme'] ) && is_array( $decoded['state']['theme'] ) ) {
				$decoded['state']['theme']['defaultMode'] = $default_mode;
				$patched                                  = wp_json_encode( $decoded );
				if ( $patched && strlen( $patched ) <= TwoKit_Store::MAX_PROJECT ) {
					$project = $patched;
				}
			}
		}

		// Closed mode: two stylesheets.
		$css = array();
		if ( 'closed' === $mode ) {
			foreach ( array_keys( TwoKit_Files::NAMES ) as $key ) {
				$clean = TwoKit_Files::clean( $body['css'][ $key ] ?? null );
				if ( is_wp_error( $clean ) ) {
					return $clean;
				}
				$css[ $key ] = $clean;
			}
		}

		// Bricks: the zip and what it holds.
		$package = null;
		if ( $bricks_active && isset( $body['bricks'] ) && is_array( $body['bricks'] ) ) {
			$package = self::package( $body['bricks'] );
			if ( is_wp_error( $package ) ) {
				return $package;
			}
		}

		$theme_style = TwoKit_Store::id( $body['themeStyle'] ?? '' );

		// Everything checked: write. The project first, so work is never lost.
		TwoKit_Store::set_project( $project );
		// The builder picker's catalog: optional, checked field by field, never blocks a save.
		if ( isset( $body['picker'] ) ) {
			TwoKit_Picker::save( $body['picker'] );
		}
		$parts = array();

		// A site's own --radius or .btn (same name, not TwoKit's) is left alone.
		if ( $package ) {
			$package = TwoKit_Bricks::skip_foreign( $package );
			// Whether this import carries font files (unchanged fonts are left out by the app).
			$package['owned']['fontsImported'] = in_array( 'custom-fonts', $package['types'], true );
		}
		$kept = $package ? $package['kept'] : array();

		if ( 'closed' === $mode ) {
			// Files first: from here on the site is styled by them, whatever happens in Bricks.
			/* translators: %s: reason, e.g. "could not create uploads/twokit". */
			$parts[] = TwoKit_Files::write( $css ) ? __( 'CSS files written', 'twokit' ) : sprintf( __( 'CSS printed inline (%s)', 'twokit' ), TwoKit_Files::$error );
			TwoKit_Store::set_mode( 'closed' );
			// No TwoKit CSS stays in Bricks: variable values, class CSS and the theme style's
			// stylesheet emptied (before the import, while TwoKit still knows which ones are
			// its own). The theme style's settings stay; Bricks prints them.
			TwoKit_Bricks::strip_styles( $theme_style, TwoKit_Store::ids( $body['variables'] ?? array() ) );
			if ( $package ) {
				$result = $package['types'] ? TwoKit_Bricks::import( $package['bytes'], $package['types'], $package['items'] ) : array();
				if ( is_wp_error( $result ) ) {
					/* translators: %s: error message from Bricks. */
					return self::error( sprintf( __( 'Saved to TwoKit files, but Bricks refused the fonts and names: %s', 'twokit' ), $result->get_error_message() ), 500 );
				}
				TwoKit_Bricks::after_import( 'closed', $package['owned'], $default_mode, $package['legacy'] );
			}
			$parts[] = $package ? __( 'Bricks keeps the theme style, fonts and names', 'twokit' ) : __( 'Bricks cleaned up', 'twokit' );
		} else {
			// Bricks first: the files are only removed once Bricks has the styles.
			$result = $package && $package['types'] ? TwoKit_Bricks::import( $package['bytes'], $package['types'], $package['items'] ) : null;
			if ( ! $result || is_wp_error( $result ) ) {
				$reason = $result ? $result->get_error_message() : __( 'the Bricks package is missing', 'twokit' );
				/* translators: %s: error message from Bricks. */
				return self::error( sprintf( __( 'Project saved, styles unchanged: Bricks refused the import (%s).', 'twokit' ), $reason ), 500 );
			}
			TwoKit_Bricks::after_import( 'open', $package['owned'], $default_mode, $package['legacy'] );
			TwoKit_Store::set_mode( 'open' );
			TwoKit_Files::delete_all();
			$parts[] = __( 'Bricks updated', 'twokit' );
		}
		TwoKit_Store::set_built();
		if ( $kept ) {
			/* translators: %s: comma-separated names such as --radius, .btn */
			$parts[] = sprintf( __( 'left your own %s alone', 'twokit' ), implode( ', ', array_slice( $kept, 0, 5 ) ) . ( count( $kept ) > 5 ? '…' : '' ) );
		}

		return new WP_REST_Response(
			array(
				'message'     => implode( ' · ', array_merge( array( __( 'Saved', 'twokit' ) ), $parts ) ),
				'kept'        => $kept,
				// What Bricks' Style manager uses now, so the app shows the same.
				'defaultMode' => $bricks_active && $package ? $default_mode : '',
			),
			200
		);
	}

	/**
	 * Checks the Bricks part of a save.
	 *
	 * @param array $raw Raw `bricks` field.
	 * @return array|WP_Error
	 */
	private static function package( array $raw ) {
		$bytes = self::zip_bytes( $raw );
		if ( is_wp_error( $bytes ) ) {
			return $bytes;
		}

		$allowed = array( 'variables', 'classes', 'color-palettes', 'theme-styles', 'custom-fonts', 'settings' );
		$types   = array_values( array_intersect( array_map( 'sanitize_key', (array) ( $raw['types'] ?? array() ) ), $allowed ) );
		if ( ! $types ) {
			return self::error( __( 'The Bricks package is empty.', 'twokit' ) );
		}
		$items = array();
		foreach ( $types as $type ) {
			if ( 'settings' === $type ) {
				// Only the two Bricks settings tabs TwoKit writes. Bricks' importer would
				// also take 'custom-code' (scripts, code execution), API keys, or an item
				// named 'settings' (every tab), so nothing else is passed on.
				$ids = array_values( array_intersect( array_map( 'sanitize_key', (array) ( $raw['items'][ $type ] ?? array() ) ), array( 'builder', 'performance' ) ) );
			} else {
				$ids = 'custom-fonts' === $type
					? array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $raw['items'][ $type ] ?? array() ) ) ) )
					: TwoKit_Store::ids( $raw['items'][ $type ] ?? array() );
			}
			if ( ! $ids ) {
				return self::error( __( 'The Bricks package lists no items.', 'twokit' ) );
			}
			$items[ $type ] = $ids;
		}

		return array(
			'bytes' => $bytes,
			'types' => $types,
			'items' => $items,
			'owned' => array(
				'classes'            => TwoKit_Store::ids( $raw['classes'] ?? array() ),
				'variables'          => TwoKit_Store::ids( $raw['variables'] ?? array() ),
				'classCategories'    => TwoKit_Store::ids( $raw['classCategories'] ?? array() ),
				'variableCategories' => TwoKit_Store::ids( $raw['variableCategories'] ?? array() ),
				'fonts'              => array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $raw['fonts'] ?? array() ) ) ) ),
				'themeStyle'         => TwoKit_Store::id( $raw['themeStyle'] ?? '' ),
				'palette'            => TwoKit_Store::id( $raw['palette'] ?? '' ),
				// Hash of the font files in this save (or of the unchanged ones it left out).
				'fontsHash'          => TwoKit_Store::hash( $raw['fontsHash'] ?? '' ),
			),
			'names' => array(
				'variables' => self::names( $raw['names']['variables'] ?? array() ),
				'classes'   => self::names( $raw['names']['classes'] ?? array() ),
				'fonts'     => self::names( $raw['names']['fonts'] ?? array() ),
			),
			// Variable categories TwoKit wrote before the "Tk " prefix; removed once empty.
			'legacy' => array_slice( TwoKit_Store::ids( $raw['legacyVariableCategories'] ?? array() ), 0, 200 ),
		);
	}

	/**
	 * An id → name map from the app (names as Bricks stores them).
	 *
	 * @param mixed $raw Raw map.
	 * @return array<string, string>
	 */
	private static function names( $raw ) {
		$out = array();
		foreach ( (array) $raw as $id => $name ) {
			$id = TwoKit_Store::id( $id );
			if ( '' !== $id && is_string( $name ) && strlen( $name ) <= 128 ) {
				$out[ $id ] = sanitize_text_field( $name );
			}
		}
		return $out;
	}

	/**
	 * A 400 (or other) error the admin app shows as is.
	 *
	 * @param string $message Message.
	 * @param int    $status  HTTP status.
	 * @return WP_Error
	 */
	private static function error( $message, $status = 400 ) {
		return new WP_Error( 'twokit_save', $message, array( 'status' => $status ) );
	}
}
