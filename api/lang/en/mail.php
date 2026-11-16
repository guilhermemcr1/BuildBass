<?php

// Notice of the decision on a driver submission. Sent in the submission's language.
return [
    'approved' => [
        'subject' => 'Your driver was approved',
        'heading' => 'Driver approved',
        'intro' => 'The driver :driver was approved and can now be found in the catalog search.',
        'outro' => 'Thank you for contributing to the catalog.',
    ],
    'rejected' => [
        'subject' => 'Your driver was not approved',
        'heading' => 'Driver not approved',
        'intro' => 'The driver :driver was not approved this time.',
        'reason' => 'Reason given by the moderator:',
        'outro' => 'You can submit a corrected version whenever you like.',
    ],
    'protocol' => 'Submission protocol: :protocol',
];
