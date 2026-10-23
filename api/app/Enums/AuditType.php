<?php

namespace App\Enums;

use Filament\Support\Contracts\HasColor;
use Filament\Support\Contracts\HasLabel;

/** Tipos de evento da trilha de auditoria (feature 010, data-model.md). */
enum AuditType: string implements HasColor, HasLabel
{
    case SubmissionApproved = 'submission_approved';
    case SubmissionRejected = 'submission_rejected';
    case SubmissionEdited = 'submission_edited';
    case DriverCreated = 'driver_created';
    case DriverUpdated = 'driver_updated';
    case DriverDeleted = 'driver_deleted';
    case DriverImagesChanged = 'driver_images_changed';
    case Login = 'login';
    case LoginFailed = 'login_failed';
    case Logout = 'logout';
    case SubmissionReceived = 'submission_received';
    case ManualRead = 'manual_read';
    case ManualBlocked = 'manual_blocked';
    case BotBlocked = 'bot_blocked';

    public const GROUP_MODERATION = 'Moderação';

    public const GROUP_ACCESS = 'Acesso';

    public const GROUP_PUBLIC_API = 'API pública';

    public function label(): string
    {
        return (string) __("audit.types.{$this->value}");
    }

    public function getLabel(): string
    {
        return $this->label();
    }

    public function group(): string
    {
        return match ($this) {
            self::SubmissionApproved,
            self::SubmissionRejected,
            self::SubmissionEdited,
            self::DriverCreated,
            self::DriverUpdated,
            self::DriverDeleted,
            self::DriverImagesChanged => self::GROUP_MODERATION,
            self::Login, self::LoginFailed, self::Logout => self::GROUP_ACCESS,
            self::SubmissionReceived,
            self::ManualRead,
            self::ManualBlocked,
            self::BotBlocked => self::GROUP_PUBLIC_API,
        };
    }

    public function getColor(): string
    {
        return match ($this->group()) {
            self::GROUP_MODERATION => 'warning',
            self::GROUP_ACCESS => 'info',
            default => 'gray',
        };
    }

    /**
     * @return array<string, array<string, string>> rótulos dos tipos agrupados, para filtros
     */
    public static function grouped(): array
    {
        $groups = [];

        foreach (self::cases() as $type) {
            $groups[$type->group()][$type->value] = $type->label();
        }

        return $groups;
    }
}
