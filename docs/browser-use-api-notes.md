# Browser Use API v2 Notes

## Authentication
- Header: `X-Browser-Use-API-Key: <apiKey>`
- NOT Bearer token format

## Base URL
`https://api.browser-use.com/api/v2`

## Endpoints

### Profiles
- GET /api/v2/profiles - List profiles
- POST /api/v2/profiles - Create profile
- GET /api/v2/profiles/:profile_id - Get profile
- DELETE /api/v2/profiles/:profile_id - Delete profile
- PATCH /api/v2/profiles/:profile_id - Update profile

### Sessions
- POST /api/v2/sessions - Create session
- GET /api/v2/sessions/:session_id - Get session
- POST /api/v2/sessions/:session_id/stop - Stop session

### Tasks
- POST /api/v2/tasks - Create task
- GET /api/v2/tasks/:task_id - Get task
- POST /api/v2/tasks/:task_id/stop - Stop task
