<?php
/**
 * Plugin Name:       TwoKit
 * Description:       A design system for Bricks Builder: colors, surfaces, fluid type and spacing, and a small set of utility classes. Saved into Bricks, or as two cached CSS files.
 * Version:           1.0.26
 * Requires at least: 6.2
 * Requires PHP:      7.4
 * Author:            Mahmud Zar
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       twokit
 *
 * @package TwoKit
 */

defined( 'ABSPATH' ) || exit;

define( 'TWOKIT_VERSION', '1.0.26' );
define( 'TWOKIT_FILE', __FILE__ );
define( 'TWOKIT_DIR', plugin_dir_path( __FILE__ ) );
define( 'TWOKIT_URL', plugin_dir_url( __FILE__ ) );

require_once TWOKIT_DIR . 'includes/class-twokit-store.php';
require_once TWOKIT_DIR . 'includes/class-twokit-files.php';
require_once TWOKIT_DIR . 'includes/class-twokit-bricks.php';
require_once TWOKIT_DIR . 'includes/class-twokit-rest.php';
require_once TWOKIT_DIR . 'includes/class-twokit-admin.php';
require_once TWOKIT_DIR . 'includes/class-twokit-frontend.php';
require_once TWOKIT_DIR . 'includes/class-twokit-picker.php';

add_action( 'rest_api_init', array( 'TwoKit_Rest', 'register' ) );
// Late: TwoKit sits inside the Bricks menu, which the theme adds at the default priority.
add_action( 'admin_menu', array( 'TwoKit_Admin', 'menu' ), 99 );
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), array( 'TwoKit_Admin', 'action_links' ) );
add_action( 'admin_init', 'twokit_upgrade' );
TwoKit_Frontend::init();
TwoKit_Picker::init();

/**
 * One-time steps after an update (runs once per version, in wp-admin).
 */
function twokit_upgrade() {
	$settings = get_option( TwoKit_Store::SETTINGS, array() );
	$settings = is_array( $settings ) ? $settings : array();
	if ( ( $settings['version'] ?? '' ) === TWOKIT_VERSION ) {
		return;
	}
	// 1.0.3 switched off Bricks' theme styles in the block editor; that's Bricks' setting.
	TwoKit_Bricks::restore_block_editor_setting();
	$settings['version'] = TWOKIT_VERSION;
	update_option( TwoKit_Store::SETTINGS, $settings, true );
}
