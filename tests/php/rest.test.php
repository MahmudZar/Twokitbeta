<?php
/**
 * TwoKit_Rest: only the builder and performance settings tabs reach Bricks
 * (security review L9); the zip never comes from the JSON part of a
 * multipart save (L14). Run with: node tests/php/run.mjs
 */

require __DIR__ . '/wp-stubs.php';
require __DIR__ . '/../../plugins/wordpress/includes/class-twokit-store.php';
require __DIR__ . '/../../plugins/wordpress/includes/class-twokit-rest.php';

$passed = 0;
$failed = 0;
function t( $name, $fn ) {
	global $passed, $failed;
	try {
		$fn();
		$passed++;
		echo "  ✓ {$name}\n";
	} catch ( Throwable $e ) {
		$failed++;
		echo "  ✗ {$name}\n    " . $e->getMessage() . "\n";
	}
}
function eq( $a, $b, $m = '' ) {
	if ( $a !== $b ) {
		throw new Exception( ( $m ? $m . ': ' : '' ) . 'expected ' . var_export( $b, true ) . ', got ' . var_export( $a, true ) );
	}
}
function call_private( $method, ...$args ) {
	$r = new ReflectionMethod( 'TwoKit_Rest', $method );
	$r->setAccessible( true );
	return $r->invoke( null, ...$args );
}
$zip = base64_encode( "PK\x03\x04" . str_repeat( 'x', 20 ) );

t( 'only the builder and performance settings tabs are passed to Bricks', function () use ( $zip ) {
	$p = call_private( 'package', [ 'zip' => $zip, 'types' => [ 'settings', 'variables' ], 'items' => [ 'settings' => [ 'builder', 'custom-code', 'settings', 'performance', 'api-keys' ], 'variables' => [ 'v1' ] ] ] );
	eq( $p['items']['settings'], [ 'builder', 'performance' ] );
} );

t( 'a settings item list with nothing allowed is refused', function () use ( $zip ) {
	$p = call_private( 'package', [ 'zip' => $zip, 'types' => [ 'settings' ], 'items' => [ 'settings' => [ 'custom-code' ] ] ] );
	eq( is_wp_error( $p ), true );
} );

t( 'multipart: a zipFile named in the JSON is ignored; only a real upload counts', function () {
	$payload = json_encode( [ 'mode' => 'open', 'bricks' => [ 'zipFile' => [ 'tmp_name' => '/etc/passwd', 'error' => 0, 'size' => 1 ] ] ] );
	$body    = call_private( 'body', new WP_REST_Request( '', [ 'payload' => $payload ], [] ) );
	eq( isset( $body['bricks']['zipFile'] ), false );
	$bytes = call_private( 'zip_bytes', [ 'zipFile' => [ 'tmp_name' => '/etc/passwd', 'error' => 0, 'size' => 1 ] ] );
	eq( is_wp_error( $bytes ), true, 'not an uploaded file' );
} );

t( 'JSON saves (older apps) still work, and a non-zip is refused', function () use ( $zip ) {
	eq( is_string( call_private( 'zip_bytes', [ 'zip' => $zip ] ) ), true );
	eq( is_wp_error( call_private( 'zip_bytes', [ 'zip' => base64_encode( '<?php evil' ) ] ) ), true );
} );

echo "\nResults: {$passed} passed, {$failed} failed\n";
echo $failed ? "TK_TEST_FAILED\n" : "TK_TEST_OK\n";
