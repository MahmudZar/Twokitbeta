<?php
/**
 * TwoKit_Bricks: after-import check of TwoKit's own items (security review
 * H2), fonts kept apart from the site's own (M5), font files no longer left
 * behind (M9). Run with: node tests/php/run.mjs
 */

require __DIR__ . '/wp-stubs.php';
require __DIR__ . '/../../plugins/wordpress/includes/class-twokit-store.php';
require __DIR__ . '/../../plugins/wordpress/includes/class-twokit-bricks.php';

$passed = 0;
$failed = 0;

function t( $name, $fn ) {
	global $passed, $failed;
	tk_reset();
	try {
		$fn();
		$passed++;
		echo "  ✓ {$name}\n";
	} catch ( Throwable $e ) {
		$failed++;
		echo "  ✗ {$name}\n    " . $e->getMessage() . "\n";
	}
}

function eq( $actual, $expected, $message = '' ) {
	if ( $actual !== $expected ) {
		throw new Exception( ( $message ? $message . ': ' : '' ) . 'expected ' . var_export( $expected, true ) . ', got ' . var_export( $actual, true ) );
	}
}

function owned( array $extra = [] ) {
	return array_merge(
		[ 'classes' => [], 'variables' => [], 'classCategories' => [], 'variableCategories' => [], 'fonts' => [], 'fontPosts' => [], 'fontsHash' => '', 'themeStyle' => '', 'palette' => '' ],
		$extra
	);
}

echo "After-import check (H2)\n";

t( 'unsafe variable values of TwoKit are cleared; the site\'s own and safe ones stay', function () {
	update_option( 'bricks_global_variables', [
		[ 'id' => 'tk1', 'name' => 'space-m', 'value' => 'clamp(1rem, 2vw, 2rem)' ],
		[ 'id' => 'tk2', 'name' => 'evil', 'value' => '0;}</style><script>alert(1)</script>' ],
		[ 'id' => 'tk3', 'name' => 'x"y', 'value' => '1px' ],
		[ 'id' => 'mine', 'name' => 'user', 'value' => '0;}</style>' ],
	] );
	$cleared = TwoKit_Bricks::scrub( owned( [ 'variables' => [ 'tk1', 'tk2', 'tk3' ] ] ) );
	$vars    = get_option( 'bricks_global_variables' );
	eq( $cleared, 2 );
	eq( array_column( $vars, 'value', 'id' ), [ 'tk1' => 'clamp(1rem, 2vw, 2rem)', 'tk2' => '', 'mine' => '0;}</style>' ] );
} );

t( 'class CSS with markup is cleared; child combinators and normal CSS stay', function () {
	update_option( 'bricks_global_classes', [
		[ 'id' => 'c1', 'name' => 'card', 'settings' => [ '_cssCustom' => '.card > .title { color: red; }' ] ],
		[ 'id' => 'c2', 'name' => 'bad', 'settings' => [ '_cssCustom' => '.bad{}</style><script>x</script>' ] ],
		[ 'id' => 'c3', 'name' => 'a"b', 'settings' => [] ],
	] );
	TwoKit_Bricks::scrub( owned( [ 'classes' => [ 'c1', 'c2', 'c3' ] ] ) );
	$classes = array_column( get_option( 'bricks_global_classes' ), null, 'id' );
	eq( $classes['c1']['settings']['_cssCustom'], '.card > .title { color: red; }' );
	eq( $classes['c2']['settings']['_cssCustom'], '' );
	eq( isset( $classes['c3'] ), false, 'invalid class name removed' );
} );

t( 'theme style stylesheet and palette colors are checked too', function () {
	update_option( 'bricks_theme_styles', [ 'tk' => [ 'settings' => [ 'css' => [ 'stylesheet' => 'body{}<!--x-->' ], 'typography' => [ 'font' => 'Inter' ] ] ] ] );
	update_option( 'bricks_color_palette', [ [ 'id' => 'pal', 'colors' => [ [ 'raw' => 'var(--a)' ], [ 'raw' => 'red;}</style>' ] ] ] ] );
	TwoKit_Bricks::scrub( owned( [ 'themeStyle' => 'tk', 'palette' => 'pal' ] ) );
	eq( get_option( 'bricks_theme_styles' )['tk']['settings']['css']['stylesheet'], '' );
	eq( get_option( 'bricks_theme_styles' )['tk']['settings']['typography']['font'], 'Inter' );
	eq( array_column( get_option( 'bricks_color_palette' )[0]['colors'], 'raw' ), [ 'var(--a)', '' ] );
} );

echo "\nFonts (M5, M9)\n";

function font_package( array $families ) {
	$items = [];
	$names = [];
	foreach ( $families as $i => $family ) {
		$items[]                   = 'custom_font_' . $i;
		$names[ 'custom_font_' . $i ] = $family;
	}
	return [
		'types' => [ 'custom-fonts' ],
		'items' => [ 'custom-fonts' => $items ],
		'names' => [ 'variables' => [], 'classes' => [], 'fonts' => $names ],
		'owned' => owned( [ 'fonts' => $families ] ),
	];
}

t( 'a site\'s own font with the same family is left out of the import', function () {
	tk_post( 10, 'bricks_fonts', 'Inter' ); // the site's own
	$p = TwoKit_Bricks::skip_foreign( font_package( [ 'Inter', 'Fraunces' ] ) );
	eq( $p['items']['custom-fonts'], [ 'custom_font_1' ] );
	eq( $p['owned']['fonts'], [ 'Fraunces' ] );
	eq( $p['kept'], [ 'Inter' ] );
} );

t( 'TwoKit\'s own font (recorded id) is updated as before', function () {
	tk_post( 11, 'bricks_fonts', 'Inter' );
	update_option( 'twokit_bricks', owned( [ 'fonts' => [ 'Inter' ], 'fontPosts' => [ 11 ] ] ) );
	$p = TwoKit_Bricks::skip_foreign( font_package( [ 'Inter' ] ) );
	eq( $p['items']['custom-fonts'], [ 'custom_font_0' ] );
} );

t( 'sites saved before ids were recorded keep owning their fonts by family', function () {
	tk_post( 12, 'bricks_fonts', 'Inter' );
	update_option( 'twokit_bricks', owned( [ 'fonts' => [ 'Inter' ] ] ) );
	$p = TwoKit_Bricks::skip_foreign( font_package( [ 'Inter' ] ) );
	eq( $p['items']['custom-fonts'], [ 'custom_font_0' ] );
} );

t( 'after an import: font post ids recorded, replaced files deleted, used files kept', function () {
	tk_post( 20, 'bricks_fonts', 'Inter' );
	tk_post( 201, 'attachment', 'old.woff2', 20 );
	tk_post( 202, 'attachment', 'new.woff2', 20 );
	$GLOBALS['tk']['meta'][20]['bricks_font_faces'] = [ '400' => [ 'woff2' => 202 ], 'unicode-range' => '201' ];
	$now = owned( [ 'fonts' => [ 'Inter' ], 'fontsHash' => str_repeat( 'a', 64 ), 'fontsImported' => true ] );
	TwoKit_Bricks::after_import( 'open', $now, 'light' );
	$stored = TwoKit_Store::bricks();
	eq( $stored['fontPosts'], [ 20 ] );
	eq( $stored['fontsHash'], str_repeat( 'a', 64 ) );
	eq( get_post_type( 201 ), false, 'old file deleted' );
	eq( get_post_type( 202 ), 'attachment', 'used file kept' );
} );

t( 'a save without font files keeps the stored hash and posts', function () {
	tk_post( 30, 'bricks_fonts', 'Inter' );
	update_option( 'twokit_bricks', owned( [ 'fonts' => [ 'Inter' ], 'fontPosts' => [ 30 ], 'fontsHash' => str_repeat( 'b', 64 ) ] ) );
	TwoKit_Bricks::after_import( 'open', owned( [ 'fonts' => [ 'Inter' ], 'fontsImported' => false ] ), 'light' );
	$stored = TwoKit_Store::bricks();
	eq( [ $stored['fontPosts'], $stored['fontsHash'] ], [ [ 30 ], str_repeat( 'b', 64 ) ] );
	eq( TwoKit_Bricks::fonts_hash(), str_repeat( 'b', 64 ) );
} );

t( 'the hash is not offered when a font post is gone (fonts are sent again)', function () {
	update_option( 'twokit_bricks', owned( [ 'fonts' => [ 'Inter' ], 'fontPosts' => [ 31 ], 'fontsHash' => str_repeat( 'c', 64 ) ] ) );
	eq( TwoKit_Bricks::fonts_hash(), '' );
} );

t( 'removing TwoKit deletes only its own font posts and their files', function () {
	tk_post( 40, 'bricks_fonts', 'Inter' );           // TwoKit's
	tk_post( 401, 'attachment', 'tk.woff2', 40 );
	tk_post( 41, 'bricks_fonts', 'Inter' );           // the site's own, same name
	tk_post( 411, 'attachment', 'site.woff2', 41 );
	update_option( 'twokit_bricks', owned( [ 'fonts' => [ 'Inter' ], 'fontPosts' => [ 40 ] ] ) );
	TwoKit_Bricks::remove_all();
	eq( get_post_type( 40 ), false );
	eq( get_post_type( 401 ), false );
	eq( get_post_type( 41 ), 'bricks_fonts', 'site font kept' );
	eq( get_post_type( 411 ), 'attachment', 'site font file kept' );
} );

echo "\nResults: {$passed} passed, {$failed} failed\n";
echo $failed ? "TK_TEST_FAILED\n" : "TK_TEST_OK\n";
