# WAYNE VAULT (secure encrypted export)

This is a manually triggered, authenticated AES-256-GCM archive generator for database records. It never writes plaintext records to disk, and includes BSON Extended JSON so BSON types can be preserved. The verifier authenticates the archive and checks collection record counts without touching the database.

## Configuration

In GitHub repository Settings > Secrets and variables > Actions, add `VAULT_MONGO_URI` (a dedicated read-only MongoDB user URI for the WAYNE LOGS database) and `VAULT_BACKUP_KEY` (32 cryptographically random bytes written as 64 hex characters). Store the encryption key outside GitHub as well. Never put either secret in files or chat.

Then run the **WAYNE VAULT encrypted backup** workflow manually under GitHub Actions. Download the encrypted `.vault` artifact and store it privately off GitHub. Artifacts expire after 14 days. Verify archives with `VAULT_BACKUP_KEY` and `node scripts/vault-verify.js <path-to-vault>`.

**This repository is public.** Archives are encrypted before upload; do not upload decrypted backups. The workflow is manual until a safe external backup destination and schedule are configured.

**Limitations:** The export is not a transactionally consistent, point-in-time MongoDB snapshot. Run during a maintenance window with writes paused for consistent collection states. An isolated restore test and a reviewed restoration utility are still needed; this is not yet a verified disaster recovery process. No customers, orders, inventory, or wallets are modified by backup and verification.
