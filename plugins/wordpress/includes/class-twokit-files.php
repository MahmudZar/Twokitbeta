<?php
/**
 * Closed mode's two stylesheets in uploads/twokit/:
 *
 *   twokit-tokens.css  variables (light and dark through Bricks' data-brx-theme)
 *   twokit.css         theme styles and the utility classes
 *
 * Both arrive minified from the admin app. File names are fixed: nothing a
 * request sends ever becomes part of a path. If the uploads folder can't be
 * written, the CSS is kept in an option and printed inline instead.
 *
 * @package TwoKit
 */

defined( 'ABSPATH' ) || exit;

/**
 * Stylesheet files.
 */
final class TwoKit_Files {

	const BACKUP = 'twokit_css';

	/**
	 * Largest stylesheet accepted (bytes).
	 */
	const MAX_CSS = 1048576;

	/**
	 * File name for each stylesheet.
	 */
	const NAMES = array(
		'tokens' => 'twokit-tokens.css',
		'styles' => 'twokit.css',
	);

	/**
	 * Folder path and URL.
	 *
	 * @return array{path: string, url: string}|null
	 */
	public static function dir() {
		$uploads = wp_upload_dir( null, false );
		if ( ! empty( $uploads['error'] ) ) {
			return null;
		}
		return array(
			'path' => trailingslashit( $uploads['basedir'] ) . 'twokit/',
			'url'  => trailingslashit( set_url_scheme( $uploads['baseurl'] ) ) . 'twokit/',
		);
	}

	/**
	 * Direct filesystem access, or null (FTP-only hosts).
	 *
	 * @return WP_Filesystem_Base|null
	 */
	private static function fs() {
		global $wp_filesystem;
		if ( ! function_exists( 'WP_Filesystem' ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
		}
		if ( 'direct' !== get_filesystem_method() || ! WP_Filesystem() ) {
			return null;
		}
		return $wp_filesystem;
	}

	/**
	 * Cleans CSS that came from the admin app. TwoKit's own output never has
	 * markup or NUL bytes, so anything like that is refused rather than fixed.
	 *
	 * @param mixed $css Raw CSS.
	 * @return string|WP_Error
	 */
	public static function clean( $css ) {
		if ( ! is_string( $css ) || strlen( $css ) > self::MAX_CSS ) {
			return new WP_Error( 'twokit_css', __( 'The stylesheet is missing or too large.', 'twokit' ), array( 'status' => 400 ) );
		}
		if ( wp_check_invalid_utf8( $css ) !== $css || false !== strpos( $css, "\0" ) || preg_match( '/<\s*\/?\s*(style|script)|<\?/i', $css ) ) {
			return new WP_Error( 'twokit_css', __( 'The stylesheet contains characters TwoKit never writes.', 'twokit' ), array( 'status' => 400 ) );
		}
		return $css;
	}

	/**
	 * Writes both stylesheets. Each is written to a temporary file first and
	 * then moved into place, so visitors never get half a file.
	 *
	 * @param array<string, string> $css Cleaned CSS keyed 'tokens' / 'styles'.
	 * @return bool True when written to files, false when kept inline only.
	 */
	public static function write( array $css ) {
		self::$error = '';
		update_option( self::BACKUP, $css, false );
		$dir = self::dir();
		if ( ! $dir ) {
			self::$error = __( 'the uploads folder is unavailable', 'twokit' );
			return false;
		}
		$fs = self::fs();
		if ( ! $fs ) {
			self::$error = __( 'WordPress has no direct file access on this server', 'twokit' );
			return false;
		}
		if ( ! $fs->is_dir( $dir['path'] ) && ! wp_mkdir_p( $dir['path'] ) ) {
			self::$error = __( 'could not create uploads/twokit', 'twokit' );
			return false;
		}
		if ( ! $fs->exists( $dir['path'] . 'index.php' ) ) {
			$fs->put_contents( $dir['path'] . 'index.php', "<?php\n// Silence is golden.\n", FS_CHMOD_FILE );
		}
		foreach ( self::NAMES as $key => $name ) {
			$target = $dir['path'] . $name;
			$temp   = $target . '.tmp';
			if ( ! $fs->put_contents( $temp, $css[ $key ] ?? '', FS_CHMOD_FILE ) || ! $fs->move( $temp, $target, true ) ) {
				$fs->delete( $temp );
				/* translators: %s: file name. */
				self::$error = sprintf( __( 'could not write %s', 'twokit' ), $name );
				return false;
			}
		}
		return true;
	}

	/**
	 * Why the last write() kept the CSS inline ('' when it didn't).
	 *
	 * @var string
	 */
	public static $error = '';

	/**
	 * URL and version of a stylesheet, or null when the file isn't there.
	 *
	 * @param string $key 'tokens' or 'styles'.
	 * @return array{url: string, version: string}|null
	 */
	public static function file( $key ) {
		$dir = self::dir();
		if ( ! $dir || ! isset( self::NAMES[ $key ] ) ) {
			return null;
		}
		$path = $dir['path'] . self::NAMES[ $key ];
		if ( ! is_readable( $path ) ) {
			return null;
		}
		return array(
			'url'     => $dir['url'] . self::NAMES[ $key ],
			'version' => (string) filemtime( $path ),
		);
	}

	/**
	 * CSS kept in the database (inline fallback).
	 *
	 * @param string $key 'tokens' or 'styles'.
	 * @return string
	 */
	public static function backup( $key ) {
		$css = get_option( self::BACKUP, array() );
		return is_array( $css ) && isset( $css[ $key ] ) && is_string( $css[ $key ] ) ? $css[ $key ] : '';
	}

	/**
	 * Removes the folder and the inline copy.
	 */
	public static function delete_all() {
		delete_option( self::BACKUP );
		$dir = self::dir();
		$fs  = self::fs();
		if ( $dir && $fs && $fs->is_dir( $dir['path'] ) ) {
			$fs->delete( $dir['path'], true );
		}
	}
}
