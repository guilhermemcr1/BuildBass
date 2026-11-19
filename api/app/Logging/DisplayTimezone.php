<?php

namespace App\Logging;

use DateTimeZone;
use Illuminate\Log\Logger;
use Monolog\Logger as Monolog;

/**
 * Logs do Laravel na hora local (`app.display_timezone`), como os do nginx e do PHP-FPM no
 * container: sem isso o Monolog usa o fuso do app (UTC) e os horários ficam 3 h adiantados.
 */
class DisplayTimezone
{
    public function __invoke(Logger $logger): void
    {
        $monolog = $logger->getLogger();

        if ($monolog instanceof Monolog) {
            $monolog->setTimezone(new DateTimeZone((string) config('app.display_timezone')));
        }
    }
}
