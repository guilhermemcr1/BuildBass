<?php

// Validation messages for the driver submission (feature 006). The app shows its own per-field
// texts; these serve anyone calling the API directly.
return [
    'required' => 'Fill in this field.',
    'string' => 'Enter text.',
    'numeric' => 'Enter a number.',
    'between' => 'Value outside the allowed range (:min to :max).',
    'max' => 'Use at most :max characters.',
    'min' => 'Fill in this field.',
    'email' => 'Enter a valid email.',
    'in' => 'Choose one of the available types.',
    'impedance' => 'Enter only the impedance in ohms, from :min to :max (e.g. 4 or 3.2).',
    'honeypot' => 'Request refused.',
    'duplicate_in_catalog' => 'This driver is already in the catalog.',
    'duplicate_pending' => 'This driver is already under review.',
    'verification_failed' => 'We could not confirm that you are not a robot. Try again.',
];
