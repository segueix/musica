(function (window) {
    const app = window.SegueixApp || (window.SegueixApp = {});
    app.utils = app.utils || {};

    function randomLetter() {
        const letters = 'abcdefghijklmnopqrstuvwxyz';
        return letters[Math.floor(Math.random() * letters.length)];
    }

    function encodePlaylistId(rowNumber) {
        const digits = String(rowNumber);
        return randomLetter() + digits[0] + randomLetter() + randomLetter() + digits.slice(1);
    }

    function decodePlaylistId(code) {
        if (!code || code.length < 2) return null;
        const firstDigit = code[1];
        const rest = code.slice(4);
        const num = parseInt(firstDigit + rest, 10);
        return isNaN(num) ? null : num;
    }

    function encodeCategoryId(rowNumber) {
        const digits = String(rowNumber);
        const randomDigit = Math.floor(Math.random() * 10);
        return randomLetter() + randomLetter() + digits[0] + randomLetter() + randomLetter() + digits.slice(1) + randomLetter() + randomLetter() + randomDigit;
    }

    function decodeCategoryId(code) {
        if (!code || code.length < 6) return null;
        const firstDigit = code[2];
        const rest = code.slice(5, code.length - 3);
        const num = parseInt(firstDigit + rest, 10);
        return isNaN(num) ? null : num;
    }

    function encodeConfigId(rowNumber) {
        const digits = String(rowNumber);
        return randomLetter() + randomLetter() + digits[0] + randomLetter() + randomLetter() + randomLetter() + digits.slice(1);
    }

    function decodeConfigId(code) {
        if (!code || code.length < 4) return null;
        const firstDigit = code[2];
        const rest = code.slice(6);
        const num = parseInt(firstDigit + rest, 10);
        return isNaN(num) ? null : num;
    }

    app.utils.idCodecs = {
        randomLetter,
        encodePlaylistId,
        decodePlaylistId,
        encodeCategoryId,
        decodeCategoryId,
        encodeConfigId,
        decodeConfigId
    };
})(window);
