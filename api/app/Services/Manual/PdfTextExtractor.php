<?php

namespace App\Services\Manual;

use App\Exceptions\Manual\ManualInvalidFileException;
use App\Exceptions\Manual\ManualUnreadableException;
use Illuminate\Support\Facades\Process;

// Texto do PDF via poppler (feature 009, research.md §1). Os binários rodam com array de argumentos,
// sem shell, sobre o arquivo temporário do próprio upload; nada é copiado nem gravado.
class PdfTextExtractor
{
    public function pageCount(string $path): int
    {
        $result = Process::timeout((int) config('manual_extraction.process_timeout'))
            ->run([(string) config('manual_extraction.binaries.pdfinfo'), $path]);

        if (! $result->successful() || preg_match('/^Pages:\s+(\d+)/m', $result->output(), $match) !== 1) {
            throw new ManualUnreadableException;
        }

        return (int) $match[1];
    }

    /**
     * @throws ManualInvalidFileException
     * @throws ManualUnreadableException
     */
    public function assertWithinPageLimit(string $path): void
    {
        if ($this->pageCount($path) > (int) config('manual_extraction.max_pages')) {
            throw new ManualInvalidFileException;
        }
    }

    /**
     * @throws ManualUnreadableException
     */
    public function extract(string $path): string
    {
        $result = Process::timeout((int) config('manual_extraction.process_timeout'))->run([
            (string) config('manual_extraction.binaries.pdftotext'),
            '-layout',
            '-f', '1',
            '-l', (string) config('manual_extraction.max_pages'),
            '-enc', 'UTF-8',
            $path,
            '-',
        ]);

        if (! $result->successful()) {
            throw new ManualUnreadableException;
        }

        $text = $this->clean($result->output());
        $letters = (int) preg_match_all('/[\p{L}\p{N}]/u', $text);

        if ($letters < (int) config('manual_extraction.min_chars')) {
            throw new ManualUnreadableException;
        }

        return mb_substr($text, 0, (int) config('manual_extraction.max_chars'));
    }

    /**
     * Texto mais curto e legível para a IA: sem controles, sem pontilhados e com as colunas do
     * layout separadas por " | " (cada parâmetro continua na mesma linha do seu valor).
     */
    private function clean(string $raw): string
    {
        $text = (string) preg_replace('/[ \t]*\x{FFFD}+[ \t]*/u', ' ', $raw);
        $text = (string) preg_replace('/[^\P{Cc}\n\t]/u', ' ', $text);
        $text = (string) preg_replace('/(?:[ \t]*[.\x{2026}_\x{00B7}]){4,}[ \t]*/u', ' ', $text);

        $lines = [];

        foreach (explode("\n", $text) as $line) {
            $line = trim($line);
            $line = (string) preg_replace('/[ \t]{3,}/', ' | ', $line);
            $line = (string) preg_replace('/[ \t]{2}/', ' ', $line);
            $line = trim($line, " |\t");

            if ($line !== '') {
                $lines[] = $line;
            }
        }

        return implode("\n", $lines);
    }
}
