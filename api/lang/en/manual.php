<?php

// Messages for the AI manual reading.
return [
    'required' => 'Upload the manual PDF.',
    'not_pdf' => 'The file must be a PDF.',
    'too_large' => 'The PDF is larger than 10 MB.',
    'too_many_pages' => 'The PDF has more than 30 pages.',
    'unreadable' => 'This PDF has no readable text (it may be an image). Fill in the fields by hand.',
    'rate_limited' => 'You have used manual filling several times. Try again later.',
    'unavailable' => 'Filling from a manual is unavailable right now. You can still fill the fields by hand.',
    'provider_failed' => 'We could not read the manual right now. Try again or fill the fields by hand.',
    'text_required' => 'Paste the text with the driver parameters.',
    'text_too_long' => 'The text is longer than :max characters. Paste only the part with the parameters.',
    'no_parameters' => 'We found no parameters in this text (for example "Fs 35 Hz"). Check the text or fill in by hand.',
];
