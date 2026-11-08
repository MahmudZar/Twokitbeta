<?php
/**
 * Everything TwoKit writes into Bricks.
 *
 * The admin app builds the same "global data" zip as the web app's Bricks
 * export, and Bricks' own importer (Unified_Global_Transfer, Bricks 2.4+)
 * applies it: variables, classes, color palette, theme style, custom fonts
 * and Builder / Performance settings. TwoKit never unzips anything itself.
 *
 * Afterwards TwoKit locks its classes, removes its own items that are no
 * longer in the project, and sets Style manager's default mode. Every change
 * is limited to ids TwoKit recorded (TwoKit_Store::bricks()), so a user's own
 * classes, variables and fonts are never touched.
 *
 * @package TwoKit
 */

defined( 'ABSPATH' ) || exit;

/**
 * Bricks integration.
 */
final class TwoKit_Bricks {

	const MIN_VERSION = '2.4';

	/**
	 * Bricks is the active theme and has the 2.4 importer.
	 *
	 * @return bool
	 */
	public static function active() {
		return defined( 'BRICKS_VERSION' )
			&& version_compare( BRICKS_VERSION, self::MIN_VERSION, '>=' )
			&& class_exists( '\Bricks\Unified_Global_Transfer' )
			&& method_exists( '\Bricks\Unified_Global_Transfer', 'import_package_bytes' );
	}

	/**
	 * Bricks version, or '' when it can't be used.
	 *
	 * @return string
	 */
	public static function version() {
		return self::active() ? (string) BRICKS_VERSION : '';
	}

	/**
	 * Imports the zip with Bricks' importer, replacing earlier TwoKit items.
	 *
	 * @param string $bytes Zip bytes.
	 * @param array  $types Transfer types in the zip.
	 * @param array  $items Item ids keyed by type.
	 * @return array|WP_Error
	 */
	public static function import( $bytes, array $types, array $items ) {
		return \Bricks\Unified_Global_Transfer::import_package_bytes( $bytes, $types, $items, 'replace', array(), false, false );
	}

	/**
	 * Leaves a site's own variables and classes alone. Bricks' importer matches
	 * by name, so a TwoKit --radius or .btn would overwrite one made by the user
	 * or another framework. Items whose name is taken by a different id (one
	 * TwoKit didn't write) are dropped from the import.
	 *
	 * @param array $package Checked package (TwoKit_Rest::package()).
	 * @return array The package without those items; 'kept' lists their names.
	 */
	public static function skip_foreign( array $package ) {
		$owned            = TwoKit_Store::bricks();
		$package['kept'] = array();
		$sources          = array(
			'variables' => array( 'bricks_global_variables', $owned['variables'] ),
			'classes'   => array( 'bricks_global_classes', $owned['classes'] ),
		);
		foreach ( $sources as $type => list( $option, $mine ) ) {
			if ( empty( $package['items'][ $type ] ) || empty( $package['names'][ $type ] ) ) {
				continue;
			}
			$taken = array();
			foreach ( (array) get_option( $option, array() ) as $item ) {
				if ( is_array( $item ) && isset( $item['name'], $item['id'] ) ) {
					$taken[ (string) $item['name'] ] = (string) $item['id'];
				}
			}
			$keep = array();
			foreach ( $package['items'][ $type ] as $id ) {
				$name  = $package['names'][ $type ][ $id ] ?? '';
				$other = '' !== $name && isset( $taken[ $name ] ) ? $taken[ $name ] : '';
				if ( '' !== $other && $other !== $id && ! in_array( $other, $mine, true ) ) {
					$package['kept'][] = ( 'variables' === $type ? '--' : '.' ) . $name;
					continue;
				}
				$keep[] = $id;
			}
			$package['items'][ $type ]       = $keep;
			$package['owned'][ $type ] = array_values( array_intersect( $package['owned'][ $type ], $keep ) );
			if ( ! $keep ) {
				$package['types'] = array_values( array_diff( $package['types'], array( $type ) ) );
				unset( $package['items'][ $type ] );
			}
		}

		// Fonts: Bricks' importer matches a font by family name and overwrites it, so a
		// site's own "Inter" would become TwoKit's (and go with it on removal). A family
		// whose font post isn't TwoKit's is left out of the import.
		if ( ! empty( $package['items']['custom-fonts'] ) ) {
			$mine = self::own_font_posts( $owned );
			$keep = array();
			foreach ( $package['items']['custom-fonts'] as $id ) {
				$family = $package['names']['fonts'][ $id ] ?? '';
				$posts  = '' !== $family ? self::font_posts_titled( $family ) : array();
				if ( array_diff( $posts, $mine ) ) {
					$package['kept'][]         = $family;
					$package['owned']['fonts'] = array_values( array_diff( $package['owned']['fonts'], array( $family ) ) );
					continue;
				}
				$keep[] = $id;
			}
			$package['items']['custom-fonts'] = $keep;
			if ( ! $keep ) {
				$package['types'] = array_values( array_diff( $package['types'], array( 'custom-fonts' ) ) );
				unset( $package['items']['custom-fonts'] );
			}
		}
		return $package;
	}

	/**
	 * Post ids of the fonts TwoKit owns. Sites saved before TwoKit recorded
	 * post ids (1.0.21 and earlier) own their fonts by family name.
	 *
	 * @param array $owned TwoKit_Store::bricks().
	 * @return int[]
	 */
	private static function own_font_posts( array $owned ) {
		if ( ! empty( $owned['fontPosts'] ) ) {
			return $owned['fontPosts'];
		}
		$ids = array();
		foreach ( $owned['fonts'] as $family ) {
			$ids = array_merge( $ids, self::font_posts_titled( $family ) );
		}
		return array_values( array_unique( $ids ) );
	}

	/**
	 * Ids of Bricks font-library posts with this family name.
	 *
	 * @param string $family Font family.
	 * @return int[]
	 */
	private static function font_posts_titled( $family ) {
		$posts = get_posts(
			array(
				'post_type'      => 'bricks_fonts',
				'post_status'    => 'any',
				'title'          => $family,
				'posts_per_page' => 20,
				'fields'         => 'ids',
			)
		);
		return array_map( 'intval', (array) $posts );
	}

	/**
	 * After an import: lock the classes, drop TwoKit items that are no longer in
	 * the project, set the default theme mode, and remember what TwoKit owns now.
	 *
	 * @param string   $mode         'closed' or 'open'.
	 * @param array    $now          What this save wrote (see TwoKit_Store::bricks()).
	 * @param string   $default_mode 'light', 'dark' or 'auto'.
	 * @param string[] $legacy       Variable category ids TwoKit used before the "Tk " prefix.
	 */
	public static function after_import( $mode, array $now, $default_mode, array $legacy = array() ) {
		$before = TwoKit_Store::bricks();

		self::remove_classes( array_diff( $before['classes'], $now['classes'] ) );
		self::lock( $now['classes'] );
		self::remove_variables( array_diff( $before['variables'], $now['variables'] ) );
		self::remove_categories( 'bricks_global_variables_categories', array_diff( $before['variableCategories'], $now['variableCategories'] ) );
		// "Base", "Brand - primary" … from before the "Tk " prefix, also when WordPress never
		// tracked them (a Bricks import made by hand). Their ids come from TwoKit's names;
		// one that still holds a variable (a user's own, moved there) stays.
		self::remove_empty_categories( 'bricks_global_variables_categories', 'bricks_global_variables', array_diff( $legacy, $now['variableCategories'] ) );
		self::remove_categories( 'bricks_global_classes_categories', array_diff( $before['classCategories'], $now['classCategories'] ) );
		self::default_mode( $default_mode );

		// Fonts: remember TwoKit's own font posts by id (only these are ever updated or
		// removed). After an import with font files, delete the files it replaced: Bricks'
		// importer uploads new ones and leaves the old ones behind. Without font files
		// (unchanged, left out by the app) the stored hash stays.
		$imported = ! empty( $now['fontsImported'] );
		unset( $now['fontsImported'] );
		$now['fontPosts'] = array();
		$mine             = self::own_font_posts( $before );
		foreach ( $now['fonts'] as $family ) {
			foreach ( self::font_posts_titled( $family ) as $post_id ) {
				// A family imported now is TwoKit's (skip_foreign left out the others).
				if ( $imported || in_array( $post_id, $mine, true ) ) {
					$now['fontPosts'][] = $post_id;
				}
			}
		}
		$now['fontPosts'] = array_values( array_unique( $now['fontPosts'] ) );
		if ( $imported ) {
			self::prune_font_files( $now['fontPosts'] );
		} else {
			$now['fontsHash'] = $before['fontsHash'];
		}

		TwoKit_Store::set_bricks( $now );
		self::scrub( $now );
	}

	/**
	 * The stored font-files hash, when TwoKit's font posts still exist (the app
	 * leaves fonts out of a save only then). '' otherwise.
	 *
	 * @return string
	 */
	public static function fonts_hash() {
		$owned = TwoKit_Store::bricks();
		if ( '' === $owned['fontsHash'] || ! $owned['fontPosts'] ) {
			return '';
		}
		foreach ( $owned['fontPosts'] as $post_id ) {
			if ( 'bricks_fonts' !== get_post_type( $post_id ) ) {
				return '';
			}
		}
		return $owned['fontsHash'];
	}

	/**
	 * Attachment ids a font post's faces use (values under file-format keys).
	 *
	 * @param int $post_id Font post.
	 * @return int[]
	 */
	private static function face_files( $post_id ) {
		$faces = get_post_meta( $post_id, 'bricks_font_faces', true );
		$ids   = array();
		if ( is_array( $faces ) ) {
			array_walk_recursive(
				$faces,
				function ( $value, $key ) use ( &$ids ) {
					if ( in_array( $key, array( 'woff2', 'woff', 'ttf', 'otf', 'eot' ), true ) && is_numeric( $value ) ) {
						$ids[] = (int) $value;
					}
				}
			);
		}
		return array_values( array_unique( $ids ) );
	}

	/**
	 * Deletes the font files attached to TwoKit's font posts that their faces
	 * no longer use (left behind when an import replaced them).
	 *
	 * @param int[] $post_ids TwoKit's font posts.
	 */
	private static function prune_font_files( array $post_ids ) {
		foreach ( $post_ids as $post_id ) {
			$used  = self::face_files( $post_id );
			$files = get_children(
				array(
					'post_parent' => $post_id,
					'post_type'   => 'attachment',
					'fields'      => 'ids',
				)
			);
			foreach ( (array) $files as $file_id ) {
				if ( ! in_array( (int) $file_id, $used, true ) ) {
					wp_delete_attachment( (int) $file_id, true );
				}
			}
		}
	}

	/**
	 * A design-token value that could end a CSS rule or Bricks' style tag
	 * (Bricks prints values raw: --name: value;).
	 */
	const UNSAFE_VALUE = '/[<>{};\\\\]|\/\*|\*\/|@import|url\s*\(|expression\s*\(|javascript\s*:|[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/i';

	/**
	 * Markup that could end Bricks' style tag inside CSS text (rules may hold braces).
	 */
	const UNSAFE_BLOCK = '/<\s*\/?\s*(style|script)\b|<!--|<\?|<\s*\//i';

	/**
	 * A class or variable name Bricks prints as a selector / property name.
	 */
	const VALID_NAME = '/^-?[A-Za-z_][A-Za-z0-9_-]*$/';

	/**
	 * Checks what Bricks stored for TwoKit's own items after an import and
	 * clears anything that could break out of the page's CSS. Bricks prints
	 * variable values, class names and CSS and theme-style CSS raw inside a
	 * <style> tag. The app checks the same before it builds the package; this
	 * is the server's own check of the result, without reading the zip.
	 *
	 * @param array $owned What TwoKit owns now (TwoKit_Store::bricks()).
	 * @return int Values cleared.
	 */
	public static function scrub( array $owned ) {
		$cleared = 0;

		// Variables: name and value.
		$vars = get_option( 'bricks_global_variables', array() );
		if ( is_array( $vars ) && ! empty( $owned['variables'] ) ) {
			$changed = false;
			foreach ( $vars as $index => $variable ) {
				if ( ! is_array( $variable ) || ! isset( $variable['id'] ) || ! in_array( $variable['id'], $owned['variables'], true ) ) {
					continue;
				}
				if ( ! preg_match( self::VALID_NAME, (string) ( $variable['name'] ?? '' ) ) ) {
					unset( $vars[ $index ] );
					$changed = true;
					++$cleared;
				} elseif ( is_string( $variable['value'] ?? null ) && preg_match( self::UNSAFE_VALUE, $variable['value'] ) ) {
					$vars[ $index ]['value'] = '';
					$changed                 = true;
					++$cleared;
				}
			}
			if ( $changed ) {
				update_option( 'bricks_global_variables', array_values( $vars ) );
			}
		}

		// Classes: name and every string in their settings (custom CSS …).
		$classes = get_option( 'bricks_global_classes', array() );
		if ( is_array( $classes ) && ! empty( $owned['classes'] ) ) {
			$changed = false;
			foreach ( $classes as $index => $class ) {
				if ( ! is_array( $class ) || ! isset( $class['id'] ) || ! in_array( $class['id'], $owned['classes'], true ) ) {
					continue;
				}
				if ( ! preg_match( self::VALID_NAME, (string) ( $class['name'] ?? '' ) ) ) {
					unset( $classes[ $index ] );
					$changed = true;
					++$cleared;
					continue;
				}
				if ( isset( $class['settings'] ) && is_array( $class['settings'] ) ) {
					$count = 0;
					$classes[ $index ]['settings'] = self::scrub_strings( $class['settings'], $count );
					if ( $count ) {
						$changed  = true;
						$cleared += $count;
					}
				}
			}
			if ( $changed ) {
				self::save_classes( array_values( $classes ) );
			}
		}

		// Theme style: every string in its settings (stylesheet, typography …).
		$styles = get_option( 'bricks_theme_styles', array() );
		$id     = (string) ( $owned['themeStyle'] ?? '' );
		if ( '' !== $id && is_array( $styles ) && isset( $styles[ $id ]['settings'] ) && is_array( $styles[ $id ]['settings'] ) ) {
			$count = 0;
			$clean = self::scrub_strings( $styles[ $id ]['settings'], $count );
			if ( $count ) {
				$styles[ $id ]['settings'] = $clean;
				update_option( 'bricks_theme_styles', $styles );
				$cleared += $count;
			}
		}

		// Palette colors: raw / light / dark values.
		$palettes = get_option( 'bricks_color_palette', array() );
		$palette  = (string) ( $owned['palette'] ?? '' );
		if ( '' !== $palette && is_array( $palettes ) ) {
			$changed = false;
			foreach ( $palettes as $p_index => $item ) {
				if ( ! is_array( $item ) || ( $item['id'] ?? '' ) !== $palette || empty( $item['colors'] ) || ! is_array( $item['colors'] ) ) {
					continue;
				}
				foreach ( $item['colors'] as $c_index => $color ) {
					foreach ( array( 'raw', 'light', 'dark' ) as $key ) {
						if ( is_array( $color ) && is_string( $color[ $key ] ?? null ) && preg_match( self::UNSAFE_VALUE, $color[ $key ] ) ) {
							$palettes[ $p_index ]['colors'][ $c_index ][ $key ] = '';
							$changed = true;
							++$cleared;
						}
					}
				}
			}
			if ( $changed ) {
				update_option( 'bricks_color_palette', $palettes );
			}
		}

		return $cleared;
	}

	/**
	 * Every string in a settings tree: CSS text with markup is emptied.
	 *
	 * @param array $settings Settings.
	 * @param int   $count    Strings emptied (by reference).
	 * @return array
	 */
	private static function scrub_strings( array $settings, &$count ) {
		foreach ( $settings as $key => $value ) {
			if ( is_array( $value ) ) {
				$settings[ $key ] = self::scrub_strings( $value, $count );
			} elseif ( is_string( $value ) && preg_match( self::UNSAFE_BLOCK, $value ) ) {
				$settings[ $key ] = '';
				++$count;
			}
		}
		return $settings;
	}

	/**
	 * TwoKit 1.0.3 turned on Bricks' "Disable Bricks theme styles in the block
	 * editor" (Settings → General). TwoKit leaves that setting to Bricks now, so
	 * the value 1.0.3 wrote is taken back. Bricks' own settings screen saves
	 * the checkbox as 'on'; only TwoKit wrote a boolean true, so a choice made
	 * in Bricks is never touched.
	 */
	public static function restore_block_editor_setting() {
		$settings = get_option( 'bricks_global_settings', array() );
		if ( is_array( $settings ) && isset( $settings['disableThemeStylesInBlockEditor'] ) && true === $settings['disableThemeStylesInBlockEditor'] ) {
			unset( $settings['disableThemeStylesInBlockEditor'] );
			update_option( 'bricks_global_settings', $settings );
		}
	}

	/**
	 * The Style manager's default mode in Bricks ('light', 'dark' or 'auto'),
	 * or '' when Bricks has none yet. It can be changed in Bricks as well as in
	 * TwoKit (Theming → Default mode); both are the same setting.
	 *
	 * @return string
	 */
	public static function current_mode() {
		$manager = get_option( 'bricks_style_manager', array() );
		$mode    = is_array( $manager ) && isset( $manager['defaultMode'] ) ? (string) $manager['defaultMode'] : '';
		return in_array( $mode, array( 'light', 'dark', 'auto' ), true ) ? $mode : '';
	}

	/**
	 * Closed mode: takes TwoKit's CSS out of Bricks, because the two files now
	 * carry it. Empties the values of TwoKit's variables, the CSS of its classes
	 * and its theme style's stylesheet. The names stay (locked classes, empty
	 * variables) so Bricks' pickers still list them, and Bricks prints no CSS
	 * for either. The theme style keeps all its settings (site background,
	 * typography, section padding, container width…): Bricks prints those, as
	 * in open mode. Works on Bricks' options directly, so it also cleans up
	 * when Bricks' importer isn't available.
	 *
	 * @param string   $theme_style TwoKit's theme style id (sent by the app).
	 * @param string[] $variables   TwoKit's variable ids (stable; sent by the app).
	 */
	public static function strip_styles( $theme_style, array $variables = array() ) {
		$owned = TwoKit_Store::bricks();

		$ids  = array_values( array_unique( array_merge( $owned['variables'], $variables ) ) );
		$vars = get_option( 'bricks_global_variables', array() );
		if ( $ids && is_array( $vars ) ) {
			$changed = false;
			foreach ( $vars as $index => $variable ) {
				if ( is_array( $variable ) && isset( $variable['id'] ) && in_array( $variable['id'], $ids, true ) && '' !== ( $variable['value'] ?? '' ) ) {
					$vars[ $index ]['value'] = '';
					$changed                 = true;
				}
			}
			if ( $changed ) {
				update_option( 'bricks_global_variables', $vars );
			}
		}

		$styles = get_option( 'bricks_theme_styles', array() );
		if ( is_array( $styles ) ) {
			$changed = false;
			foreach ( array_unique( array_filter( array( $theme_style, $owned['themeStyle'] ) ) ) as $id ) {
				if ( isset( $styles[ $id ]['settings']['css']['stylesheet'] ) && '' !== $styles[ $id ]['settings']['css']['stylesheet'] ) {
					$styles[ $id ]['settings']['css']['stylesheet'] = '';
					$changed = true;
				}
			}
			if ( $changed ) {
				// Bricks regenerates its theme-style CSS file on this update.
				update_option( 'bricks_theme_styles', $styles );
			}
		}

		$classes = get_option( 'bricks_global_classes', array() );
		if ( is_array( $classes ) && $owned['classes'] ) {
			$changed = false;
			foreach ( $classes as $index => $class ) {
				if ( is_array( $class ) && isset( $class['id'] ) && in_array( $class['id'], $owned['classes'], true ) && ! empty( $class['settings'] ) ) {
					$classes[ $index ]['settings'] = array();
					$changed                       = true;
				}
			}
			if ( $changed ) {
				self::save_classes( $classes );
			}
		}
	}

	/**
	 * Removes categories by id from a Bricks categories option
	 * (bricks_global_classes_categories / bricks_global_variables_categories).
	 *
	 * @param string   $option Option name.
	 * @param string[] $ids    Category ids.
	 */
	public static function remove_categories( $option, array $ids ) {
		$categories = get_option( $option, array() );
		if ( ! $ids || ! is_array( $categories ) ) {
			return;
		}
		$kept = array_values(
			array_filter(
				$categories,
				function ( $item ) use ( $ids ) {
					return ! ( is_array( $item ) && isset( $item['id'] ) && in_array( $item['id'], $ids, true ) );
				}
			)
		);
		if ( count( $kept ) !== count( $categories ) ) {
			update_option( $option, $kept );
		}
	}

	/**
	 * Removes categories by id, but only those no item uses.
	 *
	 * @param string   $option       Categories option.
	 * @param string   $items_option Option holding the items (bricks_global_variables).
	 * @param string[] $ids          Category ids.
	 */
	public static function remove_empty_categories( $option, $items_option, array $ids ) {
		if ( ! $ids ) {
			return;
		}
		$used = array();
		foreach ( (array) get_option( $items_option, array() ) as $item ) {
			if ( is_array( $item ) && ! empty( $item['category'] ) && is_scalar( $item['category'] ) ) {
				$used[ (string) $item['category'] ] = true;
			}
		}
		self::remove_categories(
			$option,
			array_values(
				array_filter(
					$ids,
					function ( $id ) use ( $used ) {
						return ! isset( $used[ $id ] );
					}
				)
			)
		);
	}

	/**
	 * Saves Bricks' global classes, bumping Bricks' timestamp so an open
	 * builder tab reloads instead of saving old classes back.
	 *
	 * @param array $classes Global classes.
	 */
	private static function save_classes( array $classes ) {
		if ( class_exists( '\Bricks\Helpers' ) && method_exists( '\Bricks\Helpers', 'save_global_classes_in_db' ) ) {
			\Bricks\Helpers::save_global_classes_in_db( $classes );
		} else {
			update_option( 'bricks_global_classes', $classes );
			update_option( 'bricks_global_classes_timestamp', time() );
		}
	}

	/**
	 * Locks classes so they can't be edited by accident in the builder.
	 *
	 * @param string[] $ids Class ids.
	 */
	public static function lock( array $ids ) {
		$locked = get_option( 'bricks_global_classes_locked', array() );
		$locked = is_array( $locked ) ? $locked : array();
		$merged = array_values( array_unique( array_merge( $locked, $ids ) ) );
		if ( $merged !== $locked ) {
			update_option( 'bricks_global_classes_locked', $merged, false );
		}
	}

	/**
	 * Unlocks classes (open mode uninstall: they stay, and stay editable).
	 *
	 * @param string[] $ids Class ids.
	 */
	public static function unlock( array $ids ) {
		$locked = get_option( 'bricks_global_classes_locked', array() );
		if ( is_array( $locked ) ) {
			update_option( 'bricks_global_classes_locked', array_values( array_diff( $locked, $ids ) ), false );
		}
	}

	/**
	 * Removes classes by id (and their locks).
	 *
	 * @param string[] $ids Class ids.
	 */
	public static function remove_classes( array $ids ) {
		if ( ! $ids ) {
			return;
		}
		$classes = get_option( 'bricks_global_classes', array() );
		if ( is_array( $classes ) ) {
			$kept = array_values(
				array_filter(
					$classes,
					function ( $item ) use ( $ids ) {
						return ! ( is_array( $item ) && isset( $item['id'] ) && in_array( $item['id'], $ids, true ) );
					}
				)
			);
			if ( count( $kept ) !== count( $classes ) ) {
				self::save_classes( $kept );
			}
		}
		self::unlock( $ids );
	}

	/**
	 * Removes variables by id.
	 *
	 * @param string[] $ids Variable ids.
	 */
	public static function remove_variables( array $ids ) {
		if ( ! $ids ) {
			return;
		}
		$variables = get_option( 'bricks_global_variables', array() );
		if ( ! is_array( $variables ) ) {
			return;
		}
		$kept = array_values(
			array_filter(
				$variables,
				function ( $item ) use ( $ids ) {
					return ! ( is_array( $item ) && isset( $item['id'] ) && in_array( $item['id'], $ids, true ) );
				}
			)
		);
		if ( count( $kept ) !== count( $variables ) ) {
			update_option( 'bricks_global_variables', $kept );
		}
	}

	/**
	 * Style manager's default mode (Bricks' light / dark / auto, data-brx-theme).
	 *
	 * @param string $mode 'light', 'dark' or 'auto'.
	 */
	public static function default_mode( $mode ) {
		if ( ! in_array( $mode, array( 'light', 'dark', 'auto' ), true ) ) {
			return;
		}
		$manager                = get_option( 'bricks_style_manager', array() );
		$manager                = is_array( $manager ) ? $manager : array();
		$manager['defaultMode'] = $mode;
		update_option( 'bricks_style_manager', $manager );
	}

	/**
	 * Closed mode uninstall, and Project → Remove TwoKit from this site:
	 * removes everything TwoKit put into Bricks.
	 *
	 * @param string $theme_style TwoKit's theme style id (sent by the app), in case tracking was lost.
	 */
	public static function remove_all( $theme_style = '' ) {
		$owned = TwoKit_Store::bricks();
		self::remove_classes( $owned['classes'] );
		self::remove_categories( 'bricks_global_classes_categories', $owned['classCategories'] );
		self::remove_variables( $owned['variables'] );
		self::remove_categories( 'bricks_global_variables_categories', $owned['variableCategories'] );

		if ( $owned['palette'] ) {
			$palettes = get_option( 'bricks_color_palette', array() );
			if ( is_array( $palettes ) ) {
				$kept = array_values(
					array_filter(
						$palettes,
						function ( $palette ) use ( $owned ) {
							return ! ( is_array( $palette ) && isset( $palette['id'] ) && $palette['id'] === $owned['palette'] );
						}
					)
				);
				update_option( 'bricks_color_palette', $kept );
			}
		}

		$styles = get_option( 'bricks_theme_styles', array() );
		$ids    = array_unique( array_filter( array( $owned['themeStyle'], (string) $theme_style ) ) );
		if ( $ids && is_array( $styles ) && array_intersect_key( $styles, array_flip( $ids ) ) ) {
			// Bricks regenerates its theme-style CSS file on this update.
			update_option( 'bricks_theme_styles', array_diff_key( $styles, array_flip( $ids ) ) );
		}

		// Only TwoKit's own font posts (by recorded id; by family name for sites saved
		// before ids were recorded), never a site's own font with the same family name.
		$fonts = self::own_font_posts( $owned );
		if ( $fonts ) {
			foreach ( $fonts as $post_id ) {
				self::remove_font_post( (int) $post_id );
			}
			self::refresh_font_rules();
		}
	}

	/**
	 * Rebuilds Bricks' cached @font-face rules (option bricks_font_face_rules),
	 * the way Bricks does after a font import.
	 */
	private static function refresh_font_rules() {
		delete_option( 'bricks_font_face_rules' );
		if ( ! class_exists( '\Bricks\Custom_Fonts' ) || ! method_exists( '\Bricks\Custom_Fonts', 'get_custom_fonts' ) ) {
			return;
		}
		\Bricks\Custom_Fonts::$fonts           = false;
		\Bricks\Custom_Fonts::$font_face_rules = '';
		\Bricks\Custom_Fonts::get_custom_fonts();
		if ( \Bricks\Custom_Fonts::$font_face_rules ) {
			update_option( 'bricks_font_face_rules', \Bricks\Custom_Fonts::$font_face_rules );
		}
	}

	/**
	 * Removes one of TwoKit's Bricks font posts and its files: the files
	 * attached to it and the ones its faces name (under file-format keys only).
	 *
	 * @param int $post_id Font post id.
	 */
	private static function remove_font_post( $post_id ) {
		if ( ! $post_id || 'bricks_fonts' !== get_post_type( $post_id ) ) {
			return;
		}
		// Bricks' importer attaches each font file to its font post.
		$files = get_children(
			array(
				'post_parent' => $post_id,
				'post_type'   => 'attachment',
				'fields'      => 'ids',
			)
		);
		foreach ( array_unique( array_merge( array_map( 'intval', (array) $files ), self::face_files( $post_id ) ) ) as $file_id ) {
			if ( 'attachment' === get_post_type( $file_id ) ) {
				wp_delete_attachment( $file_id, true );
			}
		}
		wp_delete_post( $post_id, true );
	}
}
