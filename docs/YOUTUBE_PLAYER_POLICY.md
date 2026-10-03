# Compliment del reproductor de YouTube

Revisió: 2026-10-03.

## Principi obligatori

El reproductor de YouTube és l'iframe oficial. Cap botó editorial de Segueix Música ha de tapar, substituir o impedir l'ús dels controls de YouTube.

Referències oficials:
- https://developers.google.com/youtube/terms/required-minimum-functionality
- https://developers.google.com/youtube/terms/developer-policies-guide
- https://developers.google.com/youtube/player_parameters

## Regles del projecte

1. No afegir botons de play/pausa propis sobre l'iframe.
2. No tapar configuració, subtítols, volum, pantalla completa, anuncis ni enllaços del reproductor.
3. Les accions de Segueix (m'agrada, cua, compartir, seguir, anterior/següent editorial) han d'estar fora de la superfície de l'iframe.
4. No bloquejar anuncis ni el botó d'ometre anunci.
5. No descarregar, extreure ni oferir només l'àudio dels vídeos.
6. No facilitar reproducció de YouTube en segon pla quan la finestra/app està tancada o minimitzada.
7. L'iframe ha de conservar un Referer/origen identificable; no usar noreferrer. `applyYouTubeIframePolicy()` aplica una política compatible.
8. Mida mínima de l'iframe: 200 × 200 px. En 16:9 es recomana 480 × 270 px quan l'espai ho permet.
9. L'autoplay només s'ha d'iniciar quan el reproductor és visible i més de la meitat és visible; mai més d'un autoplay simultani.
10. Els enllaços cap a YouTube s'han d'obrir a l'app de YouTube si el sistema ho resol, o al navegador.

## Canvis de la revisió 2026-10-03

- Desactivats els controls propis de cua superposats al reproductor normal.
- Desactivat el cor/m'agrada superposat; el control de m'agrada de sota continua disponible.
- El play/pausa continua sent el control oficial de YouTube.

## Abans de publicar a Google Play / App Store

Cal executar els tests del reproductor i fer una revisió visual en Android i iOS. Qualsevol nova UI que es posicioni dins de `#videoPlayer` s'ha de considerar sospitosa: per defecte, s'ha de col·locar fora de l'iframe.
