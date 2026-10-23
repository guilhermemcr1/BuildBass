<?php

use App\Exceptions\Manual\ManualInvalidFileException;
use App\Exceptions\Manual\ManualUnreadableException;
use App\Services\Manual\PdfTextExtractor;
use Illuminate\Support\Facades\Process;

function longText(string $extra = ''): string
{
    return str_repeat("Parâmetros Thiele Small do driver de teste com texto suficiente\n", 8).$extra;
}

it('conta as páginas com pdfinfo e extrai com pdftotext em layout, sem shell', function () {
    Process::fake([
        '*pdfinfo*' => Process::result("Title: x\nPages:          3\nEncrypted: no\n"),
        '*pdftotext*' => Process::result(longText("Qts ........ 0,717   Z ..... 4 Ohms\n")),
    ]);

    $extractor = new PdfTextExtractor;

    expect($extractor->pageCount('/tmp/ficha.pdf'))->toBe(3);

    $text = $extractor->extract('/tmp/ficha.pdf');

    expect($text)->toContain('Qts 0,717 | Z 4 Ohms');

    Process::assertRan(fn ($process) => $process->command === [
        'pdftotext', '-layout', '-f', '1', '-l', '30', '-enc', 'UTF-8', '/tmp/ficha.pdf', '-',
    ]);
    Process::assertRan(fn ($process) => $process->command === ['pdfinfo', '/tmp/ficha.pdf']);
});

it('tira pontilhados com espaços entre os pontos', function () {
    Process::fake(['*pdftotext*' => Process::result(longText("Mms . . . . . . . . . . . . 63,92 g   Rms ...... 3,441 kg/s\n"))]);

    expect((new PdfTextExtractor)->extract('/tmp/ficha.pdf'))->toContain('Mms 63,92 g | Rms 3,441 kg/s');
});

it('troca caracteres corrompidos por espaço e remove controles', function () {
    Process::fake([
        '*pdftotext*' => Process::result(longText("Qts\u{FFFD}\u{FFFD}\u{FFFD}\u{FFFD}0,42\x07\n")),
    ]);

    $text = (new PdfTextExtractor)->extract('/tmp/ficha.pdf');

    expect($text)->toContain('Qts 0,42')
        ->and($text)->not->toContain("\u{FFFD}")
        ->and($text)->not->toContain("\x07");
});

it('corta o texto em 60 000 caracteres', function () {
    Process::fake(['*pdftotext*' => Process::result(str_repeat("linha de texto longa para estourar o limite\n", 4000))]);

    expect(mb_strlen((new PdfTextExtractor)->extract('/tmp/ficha.pdf')))->toBeLessThanOrEqual(60000);
});

it('trata texto quase vazio como PDF ilegível', function () {
    Process::fake(['*pdftotext*' => Process::result("   \n\f  12  \n")]);

    (new PdfTextExtractor)->extract('/tmp/escaneado.pdf');
})->throws(ManualUnreadableException::class);

it('trata saída de erro do pdftotext (protegido ou corrompido) como ilegível', function () {
    Process::fake(['*pdftotext*' => Process::result('', 'Command Line Error: Incorrect password', 1)]);

    (new PdfTextExtractor)->extract('/tmp/protegido.pdf');
})->throws(ManualUnreadableException::class);

it('trata falha do pdfinfo como PDF ilegível', function () {
    Process::fake(['*pdfinfo*' => Process::result('', 'Syntax Error', 1)]);

    (new PdfTextExtractor)->pageCount('/tmp/quebrado.pdf');
})->throws(ManualUnreadableException::class);

it('recusa PDF com mais de 30 páginas', function () {
    Process::fake(['*pdfinfo*' => Process::result("Pages: 31\n")]);

    (new PdfTextExtractor)->assertWithinPageLimit('/tmp/grande.pdf');
})->throws(ManualInvalidFileException::class);

it('aceita PDF com 30 páginas', function () {
    Process::fake(['*pdfinfo*' => Process::result("Pages: 30\n")]);

    (new PdfTextExtractor)->assertWithinPageLimit('/tmp/ok.pdf');

    expect(true)->toBeTrue();
});
