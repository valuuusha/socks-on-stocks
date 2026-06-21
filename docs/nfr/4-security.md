# NFR-4: Local Data Security

## Test Goal

The goal of this manual security test was to verify that an FTP password is not stored or displayed as plain text after an FTP profile is saved.

The application must:

1. Mask the password in the interface.
2. Remove the entered password from the form after saving the profile.
3. Store an encrypted value instead of the original password.
4. Exclude the password and encrypted value from FTP profile API responses.

## Test Environment

- Operating system: macOS
- Test date: 2026-06-20
- Application branch: `docs-nfr`
- Browser/runtime: local Vite application at `http://127.0.0.1:5173/`
- Database: local SQLite database
- Encryption implementation: Fernet from the `cryptography` package

## Test Data

The existing local FTP profile was used:

| Field | Test value |
|---|---|
| Profile | `Local NFR Test` |
| Login | `nfrtest` |
| Password | Test password entered manually |

The password itself is intentionally not included in this report.

## Test Procedure

1. Open the FTP section of the application.
2. Select the `Local NFR Test` profile.
3. Enter the test password and save the profile by testing the connection.
4. Verify that the password field is cleared after the save request completes.
5. Toggle the password visibility button.
6. Verify that the original password cannot be displayed.
7. Inspect the `ftp_profiles.encrypted_password` value in the local database.
8. Verify that the FTP profile API response does not contain a password field.

## Expected Result

- The saved password is represented by a mask.
- Toggling visibility does not reveal the previously saved password.
- The database value differs from the original password and has the format of an encrypted Fernet token.
- The API returns connection profile fields but does not return the password or encrypted token.

## Actual Result

After saving, the password input was cleared and displayed the saved-password placeholder:

![Saved password is masked](./security-4-test/screenshots/01_saved_password_masked.png)

After toggling visibility, the password was still not revealed:

![Saved password cannot be revealed](./security-4-test/screenshots/02_password_not_revealed.png)

The database check returned:

```text
encrypted value length: 100
encrypted value equals test password: false
encrypted token prefix: gAAAAA...
```

The FTP profile response schema contains the profile name, host, port, login, directory, and ID. It does not expose either `password` or `encrypted_password`.

## Results

| Check | Result |
|---|---|
| Password is masked by default | Passed |
| Saved password is removed from the form state | Passed |
| Visibility toggle cannot reveal the saved password | Passed |
| Database does not contain the password as plain text | Passed |
| API does not return the password | Passed |
| User PIN storage | Not applicable: the MVP has no user accounts or PIN authentication |

## Defect Found and Fixed Locally

Before the fix, the password remained in the form state after the profile was saved. The visibility button could therefore reveal it as ordinary text. The form now clears the password and resets visibility immediately after a successful save.

## Conclusion

NFR-4 **passed** for the authentication data used by the current MVP. The saved FTP password is retained for future FTP operations, but it is stored as an encrypted token, is not displayed as plain text after saving, and is not returned by the API.

User PIN verification is not applicable because the MVP does not contain user accounts or PIN authentication.
