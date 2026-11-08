<?php
/**
 * Minimal WordPress stand-ins for TwoKit's PHP classes (run by tests/php/run.mjs
 * with PHP compiled to WebAssembly; no WordPress needed). Options, posts,
 * post meta and attachments live in memory.
 */

define( 'ABSPATH', __DIR__ . '/' );
define( 'TWOKIT_VERSION', 'test' );
define( 'TWOKIT_DIR', __DIR__ . '/' );
define( 'TWOKIT_URL', 'https://example.test/wp-content/plugins/twokit/' );

$GLOBALS['tk'] = [];

function tk_reset() {
	$GLOBALS['tk'] = [
		'options' => [],
		'posts'   => [], // id => [ type, title, parent ]
		'meta'    => [],
		'deleted' => [],
	];
}
tk_reset();

function get_option( $key, $default = false ) {
	return array_key_exists( $key, $GLOBALS['tk']['options'] ) ? $GLOBALS['tk']['options'][ $key ] : $default;
}
function update_option( $key, $value ) { $GLOBALS['tk']['options'][ $key ] = $value; return true; }
function delete_option( $key ) { unset( $GLOBALS['tk']['options'][ $key ] ); return true; }
function sanitize_text_field( $s ) { return trim( strip_tags( (string) $s ) ); }
function sanitize_key( $s ) { return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $s ) ); }
function absint( $v ) { return abs( (int) $v ); }
function __( $s ) { return $s; }

function tk_post( $id, $type, $title = '', $parent = 0 ) {
	$GLOBALS['tk']['posts'][ $id ] = [ 'type' => $type, 'title' => $title, 'parent' => $parent ];
}
function get_post_type( $id ) { return $GLOBALS['tk']['posts'][ (int) $id ]['type'] ?? false; }
function get_posts( $args ) {
	$out = [];
	foreach ( $GLOBALS['tk']['posts'] as $id => $p ) {
		if ( $p['type'] === $args['post_type'] && ( ! isset( $args['title'] ) || $p['title'] === $args['title'] ) ) {
			$out[] = $id;
		}
	}
	return $out;
}
function get_children( $args ) {
	$out = [];
	foreach ( $GLOBALS['tk']['posts'] as $id => $p ) {
		if ( $p['type'] === $args['post_type'] && $p['parent'] === $args['post_parent'] ) {
			$out[] = $id;
		}
	}
	return $out;
}
function get_post_meta( $id, $key ) { return $GLOBALS['tk']['meta'][ $id ][ $key ] ?? ''; }
function wp_delete_attachment( $id ) { unset( $GLOBALS['tk']['posts'][ $id ] ); $GLOBALS['tk']['deleted'][] = $id; return true; }
function wp_delete_post( $id ) { unset( $GLOBALS['tk']['posts'][ $id ] ); $GLOBALS['tk']['deleted'][] = $id; return true; }

class WP_Error {
	public $code;
	public $message;
	public function __construct( $code = '', $message = '', $data = null ) {
		$this->code    = $code;
		$this->message = $message;
	}
	public function get_error_message() { return $this->message; }
}
function is_wp_error( $v ) { return $v instanceof WP_Error; }

class WP_REST_Request {
	private $body;
	private $form;
	private $files;
	public function __construct( $body = '', $form = [], $files = [] ) {
		$this->body  = $body;
		$this->form  = $form;
		$this->files = $files;
	}
	public function get_body() { return $this->body; }
	public function get_json_params() { return json_decode( $this->body, true ); }
	public function get_body_params() { return $this->form; }
	public function get_file_params() { return $this->files; }
}
