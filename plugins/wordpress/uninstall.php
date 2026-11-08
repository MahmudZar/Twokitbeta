<?php
/**
 * Uninstall.
 *
 *   Closed mode   removes everything TwoKit added: its files, and its classes,
 *                 variables, palette, theme style and fonts in Bricks.
 *   Open mode     the site keeps its styles: Bricks keeps everything, and
 *                 TwoKit's classes are unlocked so they stay editable.
 *
 * Both remove TwoKit's own options. Runs per site on multisite.
 *
 * @package TwoKit
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

require_once __DIR__ . '/includes/class-twokit-store.php';
require_once __DIR__ . '/includes/class-twokit-files.php';
require_once __DIR__ . '/includes/class-twokit-bricks.php';

/**
 * Cleans up the current site.
 */
function twokit_uninstall_site() {
	if ( 'closed' === TwoKit_Store::mode() ) {
		TwoKit_Bricks::remove_all();
		TwoKit_Files::delete_all();
	} else {
		TwoKit_Bricks::unlock( TwoKit_Store::bricks()['classes'] );
	}
	TwoKit_Store::delete_all();
}

if ( is_multisite() ) {
	foreach ( get_sites( array( 'fields' => 'ids', 'number' => 0 ) ) as $twokit_site_id ) {
		switch_to_blog( $twokit_site_id );
		// Only sites where TwoKit ever ran: the Bricks part reads and writes several
		// options, so the rest of a large network is skipped.
		if ( false !== get_option( TwoKit_Store::SETTINGS, false ) || false !== get_option( TwoKit_Store::BRICKS, false ) || false !== get_option( TwoKit_Store::PROJECT, false ) ) {
			twokit_uninstall_site();
		}
		restore_current_blog();
	}
} else {
	twokit_uninstall_site();
}
