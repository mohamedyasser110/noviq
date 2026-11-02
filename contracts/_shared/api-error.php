<?php
// Backend (Laravel) shared error — copy into e.g. app/Exceptions/ApiException.php
// Register in App\Exceptions\Handler::register():
//   $this->renderable(function (ApiException $e, $request) {
//       return response()->json(
//           ['error' => ['code' => $e->code, 'message' => $e->getMessage(), 'details' => $e->details]],
//           $e->status
//       );
//   });
namespace App\Exceptions;

use Exception;

class ApiException extends Exception
{
    public int $status;
    public string $code;
    public mixed $details;

    public function __construct(int $status, string $code, string $message, mixed $details = null)
    {
        parent::__construct($message);
        $this->status = $status;
        $this->code = $code;
        $this->details = $details;
    }

    public static function notFound(string $message = 'Not found'): self
    {
        return new self(404, 'NOT_FOUND', $message);
    }

    public static function validation(string $message = 'Validation failed', mixed $details = null): self
    {
        return new self(400, 'VALIDATION_ERROR', $message, $details);
    }
}