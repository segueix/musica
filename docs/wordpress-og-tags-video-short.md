# Refactor OG/Twitter amb suport per URLs dinàmiques (`?v=`)

```php
add_action('wp_head', 'segueix_add_og_tags_videos_shorts', 5);
function segueix_add_og_tags_videos_shorts() {
    $post_id = 0;

    // 1) Flux habitual: pàgines singulars de video/short.
    if (is_singular(['video', 'short'])) {
        $post_id = get_the_ID();
    }

    // 2) Flux alternatiu: URL dinàmica tipus https://segueix.cat/?v=73HGv4vj29Y
    if (!$post_id && isset($_GET['v'])) {
        $video_param = sanitize_text_field(wp_unslash($_GET['v']));

        if (!empty($video_param)) {
            $meta_query = [
                'relation' => 'OR',
                [
                    'key'     => 'video_url_mp4',
                    'value'   => $video_param,
                    'compare' => 'LIKE',
                ],
                [
                    'key'     => 'short_url_mp4',
                    'value'   => $video_param,
                    'compare' => 'LIKE',
                ],
            ];

            $lookup = new WP_Query([
                'post_type'              => ['video', 'short'],
                'post_status'            => 'publish',
                'posts_per_page'         => 1,
                'fields'                 => 'ids',
                'no_found_rows'          => true,
                'update_post_meta_cache' => false,
                'update_post_term_cache' => false,
                'meta_query'             => $meta_query,
            ]);

            if (!empty($lookup->posts[0])) {
                $post_id = (int) $lookup->posts[0];
            }

            wp_reset_postdata();
        }
    }

    if (!$post_id) return;

    $post_type = get_post_type($post_id);
    if (!in_array($post_type, ['video', 'short'], true)) return;

    $title = get_the_title($post_id) . ' - Segueix.cat';
    $url = set_url_scheme(get_permalink($post_id), 'https');

    $desc = get_the_excerpt($post_id);
    if (empty($desc)) {
        $desc = wp_trim_words(get_post_field('post_content', $post_id), 30);
    }
    $desc = esc_attr(wp_strip_all_tags($desc));

    // Configuració específica per tipus de post.
    $post_config = [
        'video' => [
            'width'   => '1200',
            'height'  => '630',
            'default' => '/wp-content/uploads/default-video.jpg',
        ],
        'short' => [
            'width'   => '1080',
            'height'  => '1920',
            'default' => '/wp-content/uploads/default-short.jpg',
        ],
    ];

    $config = $post_config[$post_type];

    $thumb_id = get_post_thumbnail_id($post_id);
    if ($thumb_id) {
        $img = wp_get_attachment_image_src($thumb_id, 'large');
        $image_url = !empty($img[0])
            ? set_url_scheme($img[0], 'https')
            : home_url($config['default'], 'https');
    } else {
        $image_url = home_url($config['default'], 'https');
    }

    echo "\n\n";
    echo '<meta property="og:site_name" content="Segueix.cat" />' . "\n";
    echo '<meta property="og:title" content="' . esc_attr($title) . '" />' . "\n";
    echo '<meta property="og:description" content="' . $desc . '" />' . "\n";
    echo '<meta property="og:url" content="' . esc_url($url) . '" />' . "\n";
    echo '<meta property="og:image" content="' . esc_url($image_url) . '" />' . "\n";
    echo '<meta property="og:image:secure_url" content="' . esc_url($image_url) . '" />' . "\n";
    echo '<meta property="og:image:width" content="' . esc_attr($config['width']) . '" />' . "\n";
    echo '<meta property="og:image:height" content="' . esc_attr($config['height']) . '" />' . "\n";

    $video_url = get_post_meta($post_id, 'video_url_mp4', true);
    if (empty($video_url) && $post_type === 'short') {
        $video_url = get_post_meta($post_id, 'short_url_mp4', true);
    }

    if (!empty($video_url)) {
        $video_url = set_url_scheme($video_url, 'https');
        echo '<meta property="og:type" content="video.other" />' . "\n";
        echo '<meta property="og:video" content="' . esc_url($video_url) . '" />' . "\n";
        echo '<meta property="og:video:secure_url" content="' . esc_url($video_url) . '" />' . "\n";
        echo '<meta property="og:video:type" content="video/mp4" />' . "\n";

        echo '<meta name="twitter:card" content="player" />' . "\n";
        echo '<meta name="twitter:player" content="' . esc_url($video_url) . '" />' . "\n";
    } else {
        echo '<meta property="og:type" content="article" />' . "\n";
        echo '<meta name="twitter:card" content="summary_large_image" />' . "\n";
    }

    echo '<meta name="twitter:title" content="' . esc_attr($title) . '" />' . "\n";
    echo '<meta name="twitter:image" content="' . esc_url($image_url) . '" />' . "\n";
    echo "\n";
}
```

> **Important:** puja `default-video.jpg` i `default-short.jpg` a `/wp-content/uploads/` perquè el fallback funcioni.
