# Deployment processes own their deployment settings

A deployment process stores its own settings for one service and backend, initialized only from shared service defaults; existing target overrides are not copied, and editing the process does not change shared service or target settings. It references a target profile for connection details, so profile changes apply to future runs. A target profile cannot be deleted while a process references it; reassign or delete the process first, while retaining execution history and logs.

Processes may run manually or on selected weekdays at a fixed `Europe/Warsaw` time. Both triggers refresh the image and deploy the saved settings. Missed times are skipped; a spring daylight-saving time that does not exist is skipped, while a repeated autumn time runs only at its first occurrence. Concurrent deployments for the same service, backend, and target are skipped and recorded in the shared execution history.
