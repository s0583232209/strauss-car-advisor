System Test ChecklistScreen Opening Checks:
[V] Open the following screens: Employee, Representative, Data and Checks, Guide.
[V] In Data screen ← Calibration checks: How many of the 12 rows are green? (Note which ones are red).
Data and Calculations Checks:
[V] Load Noa and click the first chip: Does it output +661?
[V] David ← $-3,522$ and employee share in the family track $1,150$. Rachel ← $-1,938$. Yossi ← $+1,207$. Michal ← $+3,562$. Eli ← $+721$.Interface and Conversation Checks:
[V] Free-text question without a chip: Does the bot ask only for what is missing and return a comparison card?
[V] Activate "Representative Verification": Is a request created? Does it appear in the Representative screen? Does a response with a value and "Valid from" allow the conversation to continue?
[X] Refresh (F5) mid-conversation: Do the conversation and profile persist?
[V] David (field representative) requests a waiver: Is he blocked with an explanation?
[X] "Employee in Group B who waives": Is a logical result obtained?
[V] Vehicle not in the catalog (e.g., BMW): Is there an escalation rather than a guessed number?System and
Configuration Checks:
[V] Upload the CSV database in the Data screen: Is it loaded, and does ATTO 3 yield $3,130$ instead of $6,950$?
[X] Upload a fictitious payslip: Does an approval table appear?
[X] Mobile (F12 ← Toggle device toolbar, 360px): Is everything legible?
