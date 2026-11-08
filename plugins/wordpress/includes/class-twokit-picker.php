<?php
/**
 * The variable picker in the Bricks builder: right-click a value field (or
 * Alt+V) to pick a TwoKit variable. Code2Bricks' CSS editors use the same
 * picker when Code2Bricks is active.
 *
 * Loads only in the builder's main window (never on the site, never in the
 * canvas), so the site still gets no TwoKit JavaScript. The data is a plain
 * catalog of variable names and swatch colors that the app sends with each
 * save (ExportModule.pickerCatalog); it is checked field by field here,
 * stored in one option, and printed into the builder page. No REST route,
 * nothing is fetched at run time.
 *
 * @package TwoKit
 */

defined( 'ABSPATH' ) || exit;

/**
 * Builder picker.
 */
final class TwoKit_Picker {

	const OPTION = 'twokit_picker';

	/**
	 * Largest catalog stored (bytes of JSON).
	 */
	const MAX_BYTES = 262144;

	/**
	 * Most items in one catalog, all sections together.
	 */
	const MAX_ITEMS = 4000;

	/**
	 * Section types the picker draws. A shadows item is a name only: the
	 * picker builds --light-<name> / --dark-<name> and reads the values from
	 * the canvas, so no CSS is stored.
	 */
	const TYPES = array( 'pairs', 'chips', 'grid', 'palettes', 'tabs', 'shadows' );

	/**
	 * Items counted while cleaning.
	 *
	 * @var int
	 */
	private static $count = 0;

	/**
	 * Hooks.
	 */
	public static function init() {
		// The builder's main window is a front-end request (?bricks=run).
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue' ), 20 );
	}

	/**
	 * Loads the picker in the Bricks builder's main window only.
	 */
	public static function enqueue() {
		if ( ! function_exists( 'bricks_is_builder_main' ) || ! bricks_is_builder_main() || ! is_user_logged_in() || ! current_user_can( 'edit_posts' ) ) {
			return;
		}
		$handle = 'twokit-picker';
		wp_enqueue_script( $handle, TWOKIT_URL . 'assets/picker/picker.js', array(), TwoKit_Admin::ver( 'assets/picker/picker.js' ), true );
		$data = self::get();
		$json = wp_json_encode( $data ? $data : null, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT );
		wp_add_inline_script( $handle, 'window.TWOKIT_PICKER = ' . ( $json ? $json : 'null' ) . ';', 'before' );
	}

	/**
	 * The stored catalog, or null before the first save that sent one.
	 *
	 * @return array|null
	 */
	public static function get() {
		$data = get_option( self::OPTION, null );
		return is_array( $data ) && isset( $data['v'], $data['groups'] ) ? $data : null;
	}

	/**
	 * Stores a catalog from a save. Anything that doesn't check out is left
	 * out; a catalog that fails as a whole keeps the previous one.
	 *
	 * @param mixed $raw Catalog from the request body.
	 * @return bool Whether it was stored.
	 */
	public static function save( $raw ) {
		$clean = self::clean( $raw );
		if ( ! $clean ) {
			return false;
		}
		$json = wp_json_encode( $clean );
		if ( ! $json || strlen( $json ) > self::MAX_BYTES ) {
			return false;
		}
		update_option( self::OPTION, $clean, false );
		return true;
	}

	/**
	 * Removes the stored catalog (reset, uninstall).
	 */
	public static function delete() {
		delete_option( self::OPTION );
	}

	/**
	 * A checked copy of the catalog, or null.
	 *
	 * @param mixed $raw Catalog.
	 * @return array|null
	 */
	public static function clean( $raw ) {
		if ( ! is_array( $raw ) || 1 !== ( $raw['v'] ?? null ) || ! isset( $raw['groups'] ) || ! is_array( $raw['groups'] ) ) {
			return null;
		}
		self::$count = 0;
		$mode        = in_array( $raw['mode'] ?? '', array( 'light', 'dark', 'auto' ), true ) ? $raw['mode'] : 'light';
		$groups      = array();
		foreach ( array_slice( $raw['groups'], 0, 40 ) as $group ) {
			if ( ! is_array( $group ) ) {
				continue;
			}
			$id = is_string( $group['id'] ?? null ) && preg_match( '/^[a-z0-9-]{1,32}$/', $group['id'] ) ? $group['id'] : '';
			if ( '' === $id ) {
				continue;
			}
			$sections = self::sections( $group['sections'] ?? array(), true );
			if ( $sections ) {
				$groups[] = array(
					'id'       => $id,
					'label'    => self::label( $group['label'] ?? '', 40 ),
					'sections' => $sections,
				);
			}
		}
		return $groups ? array(
			'v'      => 1,
			'mode'   => $mode,
			'groups' => $groups,
		) : null;
	}

	/**
	 * Sections of a group (or of a tab, where tabs can't nest).
	 *
	 * @param mixed $raw        Sections.
	 * @param bool  $allow_tabs Whether a tabs section is allowed here.
	 * @return array
	 */
	private static function sections( $raw, $allow_tabs ) {
		$out = array();
		foreach ( array_slice( (array) $raw, 0, 12 ) as $section ) {
			$type = is_array( $section ) && is_string( $section['type'] ?? null ) ? $section['type'] : '';
			if ( ! in_array( $type, self::TYPES, true ) || ( 'tabs' === $type && ! $allow_tabs ) ) {
				continue;
			}
			$clean = array( 'type' => $type );
			if ( isset( $section['label'] ) ) {
				$clean['label'] = self::label( $section['label'], 60 );
			}
			if ( 'tabs' === $type ) {
				$tabs = array();
				foreach ( array_slice( (array) ( $section['tabs'] ?? array() ), 0, 16 ) as $tab ) {
					if ( ! is_array( $tab ) ) {
						continue;
					}
					$inner = self::sections( $tab['sections'] ?? array(), false );
					if ( ! $inner ) {
						continue;
					}
					$entry = array(
						'label'    => self::label( $tab['label'] ?? '', 32 ),
						'sections' => $inner,
					);
					$color = self::color( $tab['c'] ?? '' );
					if ( '' !== $color ) {
						$entry['c'] = $color;
					}
					$tabs[] = $entry;
				}
				if ( $tabs ) {
					$clean['tabs'] = $tabs;
					$out[]         = $clean;
				}
				continue;
			}
			$items = array();
			foreach ( array_slice( (array) ( $section['items'] ?? array() ), 0, 400 ) as $item ) {
				if ( self::$count >= self::MAX_ITEMS ) {
					break;
				}
				$item = 'palettes' === $type ? self::palette( $item ) : self::item( $item );
				if ( $item ) {
					$items[] = $item;
					++self::$count;
				}
			}
			if ( $items ) {
				$clean['items'] = $items;
				$out[]          = $clean;
			}
		}
		return $out;
	}

	/**
	 * One variable: name, optional light/dark/swatch colors, role tag, grid shape.
	 *
	 * @param mixed $raw Item.
	 * @return array|null
	 */
	private static function item( $raw ) {
		$name = is_array( $raw ) ? self::name( $raw['n'] ?? '' ) : '';
		if ( '' === $name ) {
			return null;
		}
		$item = array( 'n' => $name );
		foreach ( array( 'l', 'd', 'c' ) as $key ) {
			$color = self::color( $raw[ $key ] ?? '' );
			if ( '' !== $color ) {
				$item[ $key ] = $color;
			}
		}
		if ( isset( $raw['t'] ) ) {
			$item['t'] = self::label( $raw['t'], 24 );
		}
		if ( isset( $raw['cols'] ) && is_array( $raw['cols'] ) ) {
			$cols = array();
			foreach ( array_slice( $raw['cols'], 0, 24 ) as $col ) {
				if ( is_numeric( $col ) && $col > 0 && $col <= 12 ) {
					$cols[] = 0 + $col;
				}
			}
			if ( $cols ) {
				$item['cols'] = $cols;
			}
		}
		if ( ! empty( $raw['auto'] ) ) {
			$item['auto'] = 1;
		}
		return $item;
	}

	/**
	 * One palette: its name and base color, darker shades and lighter tints.
	 *
	 * @param mixed $raw Palette.
	 * @return array|null
	 */
	private static function palette( $raw ) {
		$name = is_array( $raw ) ? self::name( $raw['n'] ?? '' ) : '';
		if ( '' === $name ) {
			return null;
		}
		$out = array(
			'n'   => $name,
			'hex' => self::color( $raw['hex'] ?? '' ),
		);
		$step = self::name( $raw['step'] ?? '' );
		if ( '' !== $step ) {
			$out['step'] = $step;
		}
		foreach ( array( 'shades', 'tints' ) as $key ) {
			$out[ $key ] = array();
			foreach ( array_slice( (array) ( $raw[ $key ] ?? array() ), 0, 20 ) as $shade ) {
				$shade_name = is_array( $shade ) ? self::name( $shade['n'] ?? '' ) : '';
				if ( '' !== $shade_name ) {
					$out[ $key ][] = array(
						'n'   => $shade_name,
						'hex' => self::color( $shade['hex'] ?? '' ),
					);
				}
			}
		}
		return $out;
	}

	/**
	 * A CSS variable name without the leading dashes, or ''.
	 *
	 * @param mixed $value Name.
	 * @return string
	 */
	private static function name( $value ) {
		return is_string( $value ) && preg_match( '/^[A-Za-z0-9_-]{1,80}$/', $value ) && 0 !== strpos( $value, '--' ) ? $value : '';
	}

	/**
	 * #RRGGBB or #RRGGBBAA, or ''.
	 *
	 * @param mixed $value Color.
	 * @return string
	 */
	private static function color( $value ) {
		return is_string( $value ) && preg_match( '/^#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?$/', $value ) ? $value : '';
	}

	/**
	 * A short plain-text label.
	 *
	 * @param mixed $value Label.
	 * @param int   $max   Most characters.
	 * @return string
	 */
	private static function label( $value, $max ) {
		$value = is_string( $value ) ? sanitize_text_field( $value ) : '';
		return function_exists( 'mb_substr' ) ? mb_substr( $value, 0, $max ) : substr( $value, 0, $max );
	}
}
