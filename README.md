# 🤖 DOCX CREW - Member Management & Role Approval Bot

A production-ready, modular Discord bot built with **Node.js** and **discord.js v14** for **DOCX CREW**.

---

## ✨ Features

- **Automatic Visitor Role on Join**:
  - Automatically assigns the `Visitor` role to any new member joining the server.
- **Interactive `#roles` Selection Panel**:
  - Displays a clean embed with interactive buttons:
    - 🌐 **Visitor**: Confirms/assigns standard Visitor access.
    - 🚀 **Apply for Crew**: Triggers an application sent directly to server administrators for review.
- **Admin Approval System (`#crew-requests`)**:
  - When a user applies for **Crew**, an approval ticket is posted to a private admin channel (`#crew-requests`).
  - Displays applicant details (User tag, User ID, Account age, Join date).
  - Admins can click **✅ Approve Crew** or **❌ Reject**:
    - **Approve**: Bot grants the `Crew` role, removes `Visitor`, updates the card to green, and sends a congratulations DM to the user.
    - **Reject**: Updates the ticket to red and sends a notification DM to the user.
- **Join & Exit Audit Logs**:
  - `#join-logs`: Logs account creation, ID, auto-role status, and member count (Green `#2ECC71`).
  - `#exit-logs`: Logs duration spent on the server, join timestamp, and member count (Red `#E74C3C`).
- **Slash & Prefix Setup Commands**:
  - Automatically deploys the role panel to `#roles` on bot start.
  - Or manually run `/setup-roles` (or `!setup-roles`) anytime in `#roles`.

---

## ⚙️ Discord Server Setup (Important!)

### 1. Create the Roles
In your Discord server under **Server Settings -> Roles**, create:
1. `Visitor`
2. `Crew`

### 2. Role Hierarchy (CRITICAL)
Discord does not allow bots to assign roles equal to or higher than their own highest role:
- In **Server Settings -> Roles**, **drag your bot's role (`DOCX CREW`) ABOVE both the `Visitor` and `Crew` roles**.

### 3. Create the Channels
Create the following text channels in your Discord server:

| Channel Name | Visibility | Purpose |
| :--- | :--- | :--- |
| `#roles` | Public (Everyone) | Channel where members pick their role (Visitor / Crew) |
| `#crew-requests` | Private (Admins only) | Admin channel where Crew approval tickets are sent |
| `#join-logs` | Private (Admins only) | Join audit log |
| `#exit-logs` | Private (Admins only) | Exit audit log |

---

## 🚀 Running the Bot

1. Open your terminal in the bot's folder:
   ```powershell
   npm start
   ```
2. The bot will connect to Discord:
   - It will automatically post or refresh the **Role Selection Panel** in `#roles`.
   - Any new member who joins will automatically receive the `Visitor` role.
   - You can also run `/setup-roles` (or `!setup-roles`) in `#roles` to refresh the panel anytime!
