(function (window) {
    'use strict';

    const app = window.SegueixApp || (window.SegueixApp = {});
    app.features = app.features || {};

    const PAGE_W = 595;
    const PAGE_H = 842;
    const MARGIN = 42;
    const CONTENT_W = PAGE_W - MARGIN * 2;
    const EVENT_LABELS = {
        app_open: 'Entrades',
        video_open: 'Cançons obertes',
        search_used: 'Cerques',
        follow_toggle: 'Canvis de seguiment',
        like_toggle: 'Canvis de cor',
        category_open: 'Categories obertes',
        smart_feed_rendered: 'Feed intel·ligent',
        tv_start: 'Ràdios iniciades',
        tv_next: 'Següent a la ràdio',
        tv_regenerate: 'Ràdios barrejades',
        continue_watching_open: 'Continua mirant',
    };
    const LABELS = {
        mobile: 'Mòbil',
        desktop: 'Escriptori',
        home: 'Inici',
        watch: 'Vídeo',
        tv: 'TV',
        search: 'Cerca',
        follow: 'Segueix',
        library: 'Biblioteca',
        history: 'Historial',
        channel: 'Canal',
        novetats: 'Novetats',
        descobreix: 'Descobreix',
        pop: 'Pop',
        rock: 'Rock',
        indie: 'Indie',
        urbana: 'Urban',
        rap_hiphop: 'Rap / Hip-hop',
        folk_arrel: 'Folk i arrel',
        canco_autor: "Cançó d'autor",
        electronica: 'Electrònica',
        ska_reggae: 'Ska / Reggae',
        rumba_mestissatge: 'Rumba / Mestissatge',
        punk_metal: 'Punk / Metal',
        jazz_blues: 'Jazz / Blues',
        classica: 'Clàssica',
        infantil: 'Infantil',
        altres_estils: 'Altres estils',
        seguint: 'Seguint',
        tot: 'Tot / Recomanat',
        custom: 'Categoria pròpia',
        segueix: 'La teva ràdio',
        category: 'TV de categoria',
        program: 'TV de programa',
        playlist: 'Llista',
        other: 'Altres',
    };

    function number(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
    }

    function percent(a, b) {
        const denominator = number(b);
        if (!denominator) return '-';
        return `${Math.round(number(a) / denominator * 1000) / 10}%`;
    }

    function formatNumber(value) {
        return new Intl.NumberFormat('ca-ES').format(number(value));
    }

    function prettyDate(value) {
        try {
            return new Intl.DateTimeFormat('ca-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
            }).format(new Date(`${value}T12:00:00Z`));
        } catch {
            return String(value || '');
        }
    }

    function plain(value) {
        return String(value ?? '')
            .replaceAll('·', '-')
            .replace(/[“”«»]/g, '"')
            .replace(/[‘’]/g, "'")
            .replace(/[–—]/g, '-')
            .replaceAll('❤️', 'cor');
    }

    function winAnsi(value) {
        const replacements = new Map([
            ['€', 128], ['‚', 130], ['ƒ', 131], ['„', 132], ['…', 133],
            ['†', 134], ['‡', 135], ['ˆ', 136], ['‰', 137], ['Š', 138],
            ['‹', 139], ['Œ', 140], ['Ž', 142], ['‘', 145], ['’', 146],
            ['“', 147], ['”', 148], ['•', 149], ['–', 150], ['—', 151],
            ['˜', 152], ['™', 153], ['š', 154], ['›', 155], ['œ', 156],
            ['ž', 158], ['Ÿ', 159],
        ]);
        let output = '';
        for (const char of plain(value)) {
            const code = char.codePointAt(0);
            if (replacements.has(char)) {
                output += String.fromCharCode(replacements.get(char));
            } else if (code <= 255) {
                output += String.fromCharCode(code);
            } else {
                output += '?';
            }
        }
        return output;
    }

    function pdfEscape(value) {
        return winAnsi(value)
            .replaceAll('\\', '\\\\')
            .replaceAll('(', '\\(')
            .replaceAll(')', '\\)');
    }

    function textWidthApprox(value, size) {
        return plain(value).length * size * 0.5;
    }

    function wrap(value, maxWidth, size) {
        const words = plain(value).split(/\s+/).filter(Boolean);
        const lines = [];
        let current = '';
        for (const word of words) {
            const candidate = current ? `${current} ${word}` : word;
            if (current && textWidthApprox(candidate, size) > maxWidth) {
                lines.push(current);
                current = word;
            } else {
                current = candidate;
            }
        }
        if (current) lines.push(current);
        return lines.length ? lines : [''];
    }

    function buildPdf(summary) {
        const pages = [];
        let commands = [];
        let y = PAGE_H - MARGIN;

        function newPage() {
            if (commands.length) pages.push(commands.join('\n'));
            commands = [];
            y = PAGE_H - MARGIN;
        }

        function ensure(height) {
            if (y - height < MARGIN) newPage();
        }

        function fillGray(gray) {
            commands.push(`${gray} g`);
        }

        function strokeGray(gray) {
            commands.push(`${gray} G`);
        }

        function drawText(value, x, topY, size = 10, bold = false) {
            commands.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${topY.toFixed(2)} Tm (${pdfEscape(value)}) Tj ET`);
        }

        function paragraph(value, size = 9, leading = 13, bold = false) {
            const lines = wrap(value, CONTENT_W, size);
            ensure(lines.length * leading + 4);
            for (const line of lines) {
                drawText(line, MARGIN, y, size, bold);
                y -= leading;
            }
            y -= 3;
        }

        function rule() {
            ensure(8);
            strokeGray(0.82);
            commands.push(`${MARGIN} ${y} m ${PAGE_W - MARGIN} ${y} l S`);
            y -= 10;
        }

        function section(title) {
            ensure(28);
            y -= 5;
            drawText(title, MARGIN, y, 13, true);
            y -= 18;
            rule();
        }

        function keyValue(label, value) {
            ensure(18);
            drawText(label, MARGIN, y, 9, false);
            drawText(String(value), PAGE_W - MARGIN - Math.max(40, textWidthApprox(String(value), 10)), y, 10, true);
            y -= 16;
        }

        function metricBox(x, top, width, title, value, note = '') {
            fillGray(0.96);
            commands.push(`${x} ${top - 58} ${width} 58 re f`);
            fillGray(0);
            drawText(title, x + 9, top - 16, 8, false);
            drawText(String(value), x + 9, top - 35, 15, true);
            if (note) drawText(note, x + 9, top - 50, 7, false);
        }

        function dimensionSection(title, data) {
            const entries = Object.entries(data || {})
                .map(([key, value]) => [key, number(value)])
                .filter(([, value]) => value > 0)
                .sort((a, b) => b[1] - a[1]);
            section(title);
            if (!entries.length) {
                paragraph('Sense dades disponibles per aquest desglossament.');
                return;
            }
            const max = Math.max(...entries.map(([, value]) => value), 1);
            for (const [key, value] of entries.slice(0, 14)) {
                ensure(22);
                drawText(LABELS[key] || key, MARGIN, y, 9, false);
                const barX = MARGIN + 155;
                const barW = 260;
                fillGray(0.91);
                commands.push(`${barX} ${y - 3} ${barW} 7 re f`);
                fillGray(0.35);
                commands.push(`${barX} ${y - 3} ${Math.max(2, barW * value / max)} 7 re f`);
                fillGray(0);
                drawText(formatNumber(value), PAGE_W - MARGIN - 45, y, 9, true);
                y -= 17;
            }
        }

        // Capcalera
        drawText('SEGUEIX MÚSICA', MARGIN, y, 12, true);
        y -= 28;
        drawText("Informe d'analítica de Música", MARGIN, y, 24, true);
        y -= 20;
        drawText(`Període: ${prettyDate(summary.from)} - ${prettyDate(summary.to)} (${summary.days} dies)`, MARGIN, y, 10, false);
        y -= 16;
        drawText(`Generat: ${new Intl.DateTimeFormat('ca-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}`, MARGIN, y, 8, false);
        y -= 18;
        rule();

        const totals = summary.totals || {};
        const dims = summary.dimensions || {};
        const audience = summary.audience || {};
        const uniqueBrowsers = number(audience.uniqueBrowsers);
        const recurrentBrowsers = number(audience.recurrentBrowsers);
        const videoUsers = number(audience.videoUsers);
        const tvUsers = number(audience.tvUsers);
        const smartFeedUsers = number(audience.smartFeedUsers);
        const followUsers = number(audience.followUsers);
        const followOn = number(dims.state?.['follow_toggle:on']);
        const followOff = number(dims.state?.['follow_toggle:off']);
        const videoOpen = number(totals.video_open);
        const tvStarts = number(totals.tv_start);
        const tvNext = number(totals.tv_next);

        const gap = 10;
        const boxW = (CONTENT_W - gap) / 2;
        ensure(215);
        let top = y;
        metricBox(MARGIN, top, boxW, 'Usuaris únics', formatNumber(uniqueBrowsers), 'Navegadors/dispositius anònims');
        metricBox(MARGIN + boxW + gap, top, boxW, 'Recurrents', formatNumber(recurrentBrowsers), uniqueBrowsers ? `${percent(recurrentBrowsers, uniqueBrowsers)} dels únics` : '-');
        top -= 68;
        metricBox(MARGIN, top, boxW, 'Entrades', formatNumber(totals.app_open || 0));
        metricBox(MARGIN + boxW + gap, top, boxW, 'Cançons obertes', formatNumber(videoOpen));
        top -= 68;
        metricBox(MARGIN, top, boxW, 'Ràdios iniciades', formatNumber(tvStarts), `Següent / TV: ${percent(tvNext, tvStarts)}`);
        metricBox(MARGIN + boxW + gap, top, boxW, 'Cerques', formatNumber(totals.search_used || 0));
        y = top - 72;

        section('Audiència única');
        keyValue('Usuaris que han obert vídeos', formatNumber(videoUsers));
        keyValue('Usuaris de ràdio', formatNumber(tvUsers));
        keyValue('Usuaris del feed intel·ligent', formatNumber(smartFeedUsers));
        keyValue('Usuaris que han començat a seguir', formatNumber(followUsers));
        keyValue('Cançons / usuari únic', uniqueBrowsers ? number(audience.videosPerBrowser).toFixed(1).replace('.', ',') : '-');

        section('Resum');
        keyValue('Feed intel·ligent', formatNumber(totals.smart_feed_rendered || 0));
        keyValue('Nous seguiments', formatNumber(followOn));
        keyValue('Baixes de seguiment', formatNumber(followOff));
        keyValue('Seguiments / vídeo', percent(followOn, videoOpen));
        keyValue('Ràdios barrejades', formatNumber(totals.tv_regenerate || 0));
        keyValue('Continua mirant', formatNumber(totals.continue_watching_open || 0));

        section('Evolució diària');
        const daily = Array.isArray(summary.daily) ? summary.daily : [];
        const dailyHeaderY = y;
        drawText('Dia', MARGIN, dailyHeaderY, 8, true);
        drawText('Únics', MARGIN + 105, dailyHeaderY, 8, true);
        drawText('Entrades', MARGIN + 170, dailyHeaderY, 8, true);
        drawText('Vídeos', MARGIN + 255, dailyHeaderY, 8, true);
        drawText('TV', MARGIN + 335, dailyHeaderY, 8, true);
        drawText('Cerques', MARGIN + 395, dailyHeaderY, 8, true);
        y -= 14;
        rule();
        for (const row of daily) {
            ensure(17);
            drawText(prettyDate(row.day), MARGIN, y, 8, false);
            drawText(formatNumber(row.unique_browsers || 0), MARGIN + 105, y, 8, false);
            drawText(formatNumber(row.app_open || 0), MARGIN + 170, y, 8, false);
            drawText(formatNumber(row.video_open || 0), MARGIN + 255, y, 8, false);
            drawText(formatNumber(row.tv_start || 0), MARGIN + 335, y, 8, false);
            drawText(formatNumber(row.search_used || 0), MARGIN + 395, y, 8, false);
            y -= 14;
        }

        dimensionSection('Dispositiu', dims.device);
        dimensionSection('Superfície', dims.surface);
        dimensionSection('Categories', dims.category);
        dimensionSection('Tipus de ràdio', dims.tvMode);

        section('Tots els comptadors');
        for (const [key, title] of Object.entries(EVENT_LABELS)) {
            keyValue(title, formatNumber(totals[key] || 0));
        }

        section('Privacitat');
        paragraph("Els usuaris únics representen navegadors/dispositius anònims, no persones identificades. L'identificador aleatori rota cada 90 dies i el servidor només en conserva un hash no reversible. No es desen adreces IP, user-agent, textos de cerca, identificadors de vídeos ni de canals.", 8, 12);

        if (commands.length) pages.push(commands.join('\n'));

        const objects = [];
        const addObject = body => {
            objects.push(body);
            return objects.length;
        };

        const catalogId = addObject('');
        const pagesId = addObject('');
        const fontRegularId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
        const fontBoldId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

        const pageIds = [];
        pages.forEach(stream => {
            const streamId = addObject(`<< /Length ${winAnsi(stream).length} >>\nstream\n${stream}\nendstream`);
            const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${streamId} 0 R >>`);
            pageIds.push(pageId);
        });

        objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
        objects[pagesId - 1] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] >>`;

        let binary = '%PDF-1.4\n%SEGUEIX\n';
        const offsets = [0];
        objects.forEach((body, index) => {
            offsets.push(binary.length);
            binary += `${index + 1} 0 obj\n${winAnsi(body)}\nendobj\n`;
        });

        const xref = binary.length;
        binary += `xref\n0 ${objects.length + 1}\n`;
        binary += '0000000000 65535 f \n';
        for (let i = 1; i < offsets.length; i += 1) {
            binary += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
        }
        binary += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

        return new Uint8Array(Array.from(binary, char => char.charCodeAt(0) & 255));
    }

    function download(summary) {
        if (!summary?.from || !summary?.to) throw new Error('SUMMARY_RANGE_REQUIRED');
        const bytes = buildPdf(summary);
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `segueix-musica-analytics-${summary.from}-${summary.to}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        return link.download;
    }

    app.features.analyticsPdf = {
        buildPdf,
        download,
    };
})(window);
