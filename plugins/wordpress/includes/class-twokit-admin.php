<?php
/**
 * The TwoKit admin page.
 *
 * TwoKit opens inside the WordPress dashboard: wp-admin's menu and admin bar
 * stay, and the app fills the content area in an iframe. The iframe loads the
 * same admin page with &frame=1, which renders only the app (its own
 * document), so wp-admin CSS never reaches the app and the app's CSS never
 * reaches wp-admin.
 *
 * The page tells the browser about unsaved changes (it asks before leaving)
 * and forwards Ctrl/Cmd S to the app when focus is in wp-admin.
 *
 * @package TwoKit
 */

defined( 'ABSPATH' ) || exit;

/**
 * Admin page.
 */
final class TwoKit_Admin {

	const SLUG = 'twokit';

	/**
	 * Admin page hook suffix.
	 *
	 * @var string
	 */
	private static $hook = '';

	/**
	 * The menu TwoKit sits under: Bricks, or Appearance without Bricks.
	 *
	 * @var string
	 */
	private static $parent = 'bricks';

	/**
	 * Adds the menu item: inside the Bricks menu, so TwoKit adds no top-level
	 * item to the dashboard. Hooked late (see twokit.php): Bricks' menu has to
	 * exist first, or WordPress gives the page a hook name it won't find again.
	 * Without the Bricks menu (another theme: TwoKit files work with any theme)
	 * TwoKit goes under Appearance.
	 */
	public static function menu() {
		global $admin_page_hooks;
		self::$parent = isset( $admin_page_hooks['bricks'] ) ? 'bricks' : 'themes.php';
		self::redirect();
		self::$hook = (string) add_submenu_page(
			self::$parent,
			__( 'TwoKit', 'twokit' ),
			__( 'TwoKit', 'twokit' ),
			'manage_options',
			self::SLUG,
			array( __CLASS__, 'page' )
		);
		if ( '' !== self::$hook ) {
			add_action( 'load-' . self::$hook, array( __CLASS__, 'load' ) );
		}
	}

	/**
	 * The TwoKit page's address (admin.php?page=twokit under Bricks,
	 * themes.php?page=twokit under Appearance).
	 *
	 * @return string
	 */
	public static function url() {
		return admin_url( ( 'bricks' === self::$parent ? 'admin.php' : self::$parent ) . '?page=' . self::SLUG );
	}

	/**
	 * Bookmarks and links to admin.php?page=twokit keep working when TwoKit is
	 * under Appearance (WordPress only knows that page at themes.php there).
	 * Runs while the menu is built: WordPress refuses the unknown page right after.
	 */
	private static function redirect() {
		global $pagenow;
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only redirect to the same page.
		if ( 'bricks' === self::$parent || 'admin.php' !== $pagenow || ! isset( $_GET['page'] ) || self::SLUG !== sanitize_key( wp_unslash( $_GET['page'] ) ) || ! current_user_can( 'manage_options' ) ) {
			return;
		}
		wp_safe_redirect( self::url() );
		exit;
	}

	/**
	 * "Open TwoKit" on the Plugins screen.
	 *
	 * @param string[] $links Action links.
	 * @return string[]
	 */
	public static function action_links( $links ) {
		array_unshift( $links, sprintf( '<a href="%s">%s</a>', esc_url( self::url() ), esc_html__( 'Open TwoKit', 'twokit' ) ) );
		return $links;
	}

	/**
	 * Before the page renders: the app document for the iframe, or the
	 * dashboard page around it.
	 */
	public static function load() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Sorry, you are not allowed to access this page.', 'twokit' ), 403 );
		}
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only view switch, capability checked above.
		if ( isset( $_GET['frame'] ) ) {
			self::app();
		}
		// Other plugins' notices would push the app below the fold. WordPress' own
		// update and maintenance notices stay (an available core or security update
		// must not be hidden).
		remove_all_actions( 'admin_notices' );
		remove_all_actions( 'all_admin_notices' );
		if ( function_exists( 'update_nag' ) ) {
			add_action( 'admin_notices', 'update_nag', 3 );
		}
		if ( function_exists( 'maintenance_nag' ) ) {
			add_action( 'admin_notices', 'maintenance_nag', 10 );
		}
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'assets' ) );
	}

	/**
	 * The dashboard page's own CSS and JS (small, inline, this page only).
	 */
	public static function assets() {
		wp_register_style( 'twokit-admin', false, array(), TWOKIT_VERSION );
		wp_enqueue_style( 'twokit-admin' );
		wp_add_inline_style(
			'twokit-admin',
			'#wpcontent{padding-left:0}#wpbody-content{padding-bottom:0}#wpfooter{display:none}'
			. '.twokit-frame{display:block;width:100%;height:calc(100vh - var(--wp-admin--admin-bar--height,32px));border:0;background:#131515}'
		);

		wp_register_script( 'twokit-admin', false, array(), TWOKIT_VERSION, true );
		wp_enqueue_script( 'twokit-admin' );
		wp_add_inline_script(
			'twokit-admin',
			'(function(){var dirty=false,frame=document.querySelector(".twokit-frame");'
			. 'addEventListener("message",function(e){if(e.origin===location.origin&&frame&&e.source===frame.contentWindow&&e.data&&e.data.twokit&&e.data.action==="dirty"){dirty=!!e.data.value;}});'
			. 'addEventListener("beforeunload",function(e){if(dirty){e.preventDefault();e.returnValue="";}});'
			. 'addEventListener("keydown",function(e){if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="s"&&frame&&frame.contentWindow){e.preventDefault();frame.contentWindow.postMessage({twokit:true,action:"save"},location.origin);}});'
			// Only the app belongs in the frame: anything else (a link, an old cached app) opens in the whole window.
			. 'if(frame){frame.addEventListener("load",function(){try{var u=new URL(frame.contentWindow.location.href);if(u.searchParams.get("page")!=="twokit"||!u.searchParams.has("frame")){location.href=u.href;}}catch(x){}});}'
			. '}());'
		);
	}

	/**
	 * The dashboard page: the app in an iframe.
	 */
	public static function page() {
		printf(
			'<iframe class="twokit-frame" src="%s" title="%s"></iframe>',
			esc_url( self::url() . '&frame=1' ),
			esc_attr__( 'TwoKit', 'twokit' )
		);
	}

	/**
	 * Version for a plugin file: the plugin version plus the file's modification
	 * time, so every new build reaches the browser instead of a cached copy.
	 *
	 * @param string $file Path inside the plugin.
	 * @return string
	 */
	public static function ver( $file ) {
		$time = @filemtime( TWOKIT_DIR . $file ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- a missing file just falls back to the plugin version.
		return $time ? TWOKIT_VERSION . '.' . $time : TWOKIT_VERSION;
	}

	/**
	 * The scheme://host[:port] of a URL, for the CSP (TwoKit's files may be
	 * served from a CDN host). '' when it can't be read.
	 *
	 * @param string $url URL.
	 * @return string
	 */
	private static function origin( $url ) {
		$parts = wp_parse_url( $url );
		if ( empty( $parts['scheme'] ) || empty( $parts['host'] ) || ! in_array( $parts['scheme'], array( 'http', 'https' ), true ) ) {
			return '';
		}
		$host = preg_replace( '/[^a-z0-9.\-]/i', '', $parts['host'] );
		return $parts['scheme'] . '://' . $host . ( isset( $parts['port'] ) ? ':' . (int) $parts['port'] : '' );
	}

	/**
	 * Renders the app document (the iframe) and stops.
	 */
	private static function app() {
		nocache_headers();
		// Only this site may frame the app; scripts only from TwoKit's own files: no
		// inline scripts and no event-handler attributes, so markup injected into the
		// app can't run. 'unsafe-eval' is for the font worker (its WebAssembly and
		// emscripten bindings use new Function; some browsers apply the page's policy
		// to its workers). No plugins/objects; no MIME sniffing; no admin URLs leak to
		// other sites. The page data is a JSON block, not an inline script.
		$assets = self::origin( TWOKIT_URL );
		header(
			"Content-Security-Policy: frame-ancestors 'self'; script-src 'self'" . ( $assets ? ' ' . $assets : '' )
			. " 'unsafe-eval' 'wasm-unsafe-eval'; object-src 'none'; base-uri 'self'"
		);
		header( 'X-Frame-Options: SAMEORIGIN' );
		header( 'X-Content-Type-Options: nosniff' );
		header( 'Referrer-Policy: same-origin' );

		$data = array(
			'rest'       => esc_url_raw( rest_url( TwoKit_Rest::NAMESPACE . '/' ) ),
			'nonce'      => wp_create_nonce( 'wp_rest' ),
			'mode'       => TwoKit_Store::mode(),
			'bricks'     => TwoKit_Bricks::version(),
			'canSave'    => TwoKit_Rest::can_save(),
			'project'    => self::project(),
			// Bricks' Style manager mode as the app sees it, so a save can tell a change
			// made in Bricks meanwhile from one made in TwoKit.
			'bricksMode' => TwoKit_Bricks::active() ? TwoKit_Bricks::current_mode() : '',
			'adminUrl'   => esc_url_raw( admin_url() ),
			'pageUrl'    => esc_url_raw( self::url() ),
			'assetBase'  => esc_url_raw( TWOKIT_URL . 'assets/' ),
			'version'    => TWOKIT_VERSION,
			// The version whose app wrote the site's CSS; older means "save once".
			'built'      => TwoKit_Store::built(),
			// Hash of the font files Bricks has from TwoKit: unchanged fonts aren't sent again.
			'fontsHash'  => TwoKit_Bricks::active() ? TwoKit_Bricks::fonts_hash() : '',
			// Largest file upload PHP accepts: larger Bricks packages go as base64 JSON.
			'maxUpload'  => (int) wp_max_upload_size(),
		);

		wp_register_style( 'twokit-app', TWOKIT_URL . 'assets/app.css', array(), self::ver( 'assets/app.css' ) );
		wp_register_script( 'twokit-host', TWOKIT_URL . 'assets/host.js', array(), self::ver( 'assets/host.js' ), false );
		// The data as a JSON block right before host.js (which reads it): never executed,
		// so the CSP above needs no inline-script exception. JSON_HEX_* keeps it inside the tag.
		$json = wp_json_encode( $data, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT );
		add_filter(
			'script_loader_tag',
			function ( $tag, $handle ) use ( $json ) {
				if ( 'twokit-host' !== $handle ) {
					return $tag;
				}
				return '<script type="application/json" id="twokit-wp-data">' . ( $json ? $json : '{}' ) . "</script>\n" . $tag;
			},
			10,
			2
		);
		wp_register_script( 'twokit-app', TWOKIT_URL . 'assets/app.js', array( 'twokit-host' ), self::ver( 'assets/app.js' ), true );

		require TWOKIT_DIR . 'views/app.php';
		exit;
	}

	/**
	 * The saved project, with the theme mode Bricks uses now. The Style manager's
	 * default mode is the same setting as TwoKit's Theming → Default mode, and it
	 * can be changed in Bricks; TwoKit opens with whatever Bricks has.
	 *
	 * @return string
	 */
	private static function project() {
		$json = TwoKit_Store::project();
		$mode = TwoKit_Bricks::active() ? TwoKit_Bricks::current_mode() : '';
		if ( '' === $json || '' === $mode ) {
			return $json;
		}
		$project = json_decode( $json, true, 64 );
		if ( ! is_array( $project ) || ! isset( $project['state']['theme'] ) || ! is_array( $project['state']['theme'] )
			|| ( $project['state']['theme']['defaultMode'] ?? '' ) === $mode ) {
			return $json;
		}
		$project['state']['theme']['defaultMode'] = $mode;
		$patched                                  = wp_json_encode( $project );
		return $patched ? $patched : $json;
	}
}
