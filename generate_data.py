import json
import random

system_prompt = "You are a Principal Engineer. Review code concisely, prioritizing logic. Strictly structure responses as: [Issue] -> [Impact] -> [Fix (Code Diff)]."

TEMPLATES = [
    # ---- GO ----
    {
        "lang": "Go",
        "category": "Distributed Systems",
        "issue": "Goroutine leak due to unbuffered channel without a timeout or context cancellation.",
        "impact": "If the third-party API times out, the goroutine remains blocked forever, eventually exhausting system memory.",
        "prompt_diff": """+ func fetchRemoteData() string {
+     ch := make(chan string)
+     go func() {
+         res := api.Fetch()
+         ch <- res // blocks forever if fetchRemoteData returns early
+     }()
+     return <-ch
+ }""",
        "fix_diff": """```go
func fetchRemoteData(ctx context.Context) (string, error) {
    ch := make(chan string, 1) // Buffered channel prevents leaks
    go func() {
        ch <- api.Fetch()
    }()
    
    select {
    case res := <-ch:
        return res, nil
    case <-ctx.Done():
        return "", ctx.Err()
    }
}
```"""
    },
    {
        "lang": "Go",
        "category": "Performance",
        "issue": "Database N+1 query problem inside a slice iteration.",
        "impact": "Triggers N additional queries. Severe database load and latency spikes as the dataset grows.",
        "prompt_diff": """+ func GetUsersWithProfiles(db *sql.DB) ([]User, error) {
+     users, _ := db.Query("SELECT id, name FROM users")
+     // ... parsing usersList
+     for i, u := range usersList {
+         var bio string
+         db.QueryRow("SELECT bio FROM profiles WHERE user_id = ?", u.ID).Scan(&bio)
+         usersList[i].Bio = bio
+     }
+     return usersList, nil
+ }""",
        "fix_diff": """```go
func GetUsersWithProfiles(db *sql.DB) ([]User, error) {
    // Fixed: Single query using JOIN
    rows, err := db.Query(`
        SELECT u.id, u.name, p.bio 
        FROM users u 
        LEFT JOIN profiles p ON u.id = p.user_id
    `)
    // ... parse and return
}
```"""
    },
    {
        "lang": "Go",
        "category": "Data Integrity",
        "issue": "Concurrent HTTP handlers mutating shared state without a mutex.",
        "impact": "Race conditions leading to unrecoverable silent data corruption in memory.",
        "prompt_diff": """+ var userCache = make(map[string]string)
+ 
+ func updateProfileHandler(w http.ResponseWriter, r *http.Request) {
+     id := r.FormValue("id")
+     bio := r.FormValue("bio")
+     userCache[id] = bio // Concurrent map writes will panic or corrupt
+ }""",
        "fix_diff": """```go
var (
    userCache = make(map[string]string)
    mu        sync.RWMutex
)

func updateProfileHandler(w http.ResponseWriter, r *http.Request) {
    id := r.FormValue("id")
    bio := r.FormValue("bio")
    
    mu.Lock()
    userCache[id] = bio
    mu.Unlock()
}
```"""
    },
    # ---- TYPESCRIPT ----
    {
        "lang": "TypeScript",
        "category": "Distributed Systems",
        "issue": "Using Promise.all for independent distributed operations without failure isolation.",
        "impact": "If one operation faults, the entire batch rejects immediately, discarding successes and leaving partial states.",
        "prompt_diff": """+ async function processBatch(jobs: Job[]) {
+     await Promise.all(jobs.map(async (job) => {
+         await externalAPI.submit(job.data);
+         await db.markDone(job.id);
+     }));
+ }""",
        "fix_diff": """```typescript
async function processBatch(jobs: Job[]) {
    // Fixed: Use Promise.allSettled to ensure all jobs attempt completion
    const results = await Promise.allSettled(jobs.map(async (job) => {
        await externalAPI.submit(job.data);
        await db.markDone(job.id);
    }));
    
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) logError(failures);
}
```"""
    },
    {
        "lang": "TypeScript",
        "category": "Performance",
        "issue": "Creating object identities inside render functions triggering cascaded re-renders.",
        "impact": "Violates React identity checks. Causes expensive, unnecessary child component re-renders.",
        "prompt_diff": """+ function Dashboard({ data }) {
+     // Passing a fresh object every render
+     return <Chart config={{ theme: 'dark', animated: true }} data={data} />;
+ }""",
        "fix_diff": """```typescript
// Fixed: Hoist static objects outside the component or use useMemo
const CHART_CONFIG = { theme: 'dark', animated: true };

function Dashboard({ data }) {
    return <Chart config={CHART_CONFIG} data={data} />;
}
```"""
    },
    {
        "lang": "TypeScript",
        "category": "Data Integrity",
        "issue": "Serverless lambda accepts arbitrary payloads without schema validation.",
        "impact": "Allows injection of unexpected fields (e.g., role='admin'). Compromises database state.",
        "prompt_diff": """+ export const handler = async (event) => {
+     const body = JSON.parse(event.body);
+     await dynamoClient.put({
+         TableName: 'Users',
+         Item: body // Unvalidated input straight to DB
+     }).promise();
+     return { statusCode: 200 };
+ };""",
        "fix_diff": """```typescript
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string(),
  email: z.string().email()
});

export const handler = async (event) => {
    const validated = UserSchema.safeParse(JSON.parse(event.body));
    if (!validated.success) return { statusCode: 400 };
    
    await dynamoClient.put({
        TableName: 'Users',
        Item: validated.data
    }).promise();
    return { statusCode: 200 };
};
```"""
    },
    # ---- PYTHON ----
    {
        "lang": "Python",
        "category": "Distributed Systems",
        "issue": "Celery task ACKs early and lacks idempotency during distributed failure.",
        "impact": "If the worker node crashes during DB operation, the message is lost forever (acknowledged but incomplete).",
        "prompt_diff": """+ @app.task(acks_late=False)
+ def charge_credit_card(user_id, amount):
+     api.charge(user_id, amount)
+     # Crash here means charge happens, but not written to DB
+     db.session.add(Payment(user_id, amount))
+     db.session.commit()""",
        "fix_diff": """```python
# Fixed: Enable acks_late and ensure idempotency (idempotency key via DB)
@app.task(acks_late=True, bind=True)
def charge_credit_card(self, user_id, amount, idempotency_key):
    if db.session.query(Payment).filter_by(ikey=idempotency_key).first():
        return # Already processed
        
    api.charge(user_id, amount, idempotency_key=idempotency_key)
    db.session.add(Payment(user_id, amount, idempotency_key))
    db.session.commit()
```"""
    },
    {
        "lang": "Python",
        "category": "Performance",
        "issue": "Django ORM lazy loading inside a loop (N+1 scenario).",
        "impact": "Fetches foreign keys individually per row. Latency grows linearly with result size.",
        "prompt_diff": """+ def get_author_emails():
+     books = Book.objects.filter(published=True)
+     emails = []
+     for book in books:
+         emails.append(book.author.email) # Triggers DB call
+     return emails""",
        "fix_diff": """```python
def get_author_emails():
    # Fixed: Use select_related to join the Author table in the initial query
    books = Book.objects.select_related('author').filter(published=True)
    return [book.author.email for book in books]
```"""
    },
    {
        "lang": "Python",
        "category": "Data Integrity",
        "issue": "Mutable default arguments in entity constructors.",
        "impact": "State is shared across all object instances. Modifying one entity mutates all entities subsequently created.",
        "prompt_diff": """+ class PipelineConfig:
+     def __init__(self, retries=3, flags=[]):
+         self.retries = retries
+         self.flags = flags # lists are mutable defaults
+         
+ def add_flag(config, flag):
+     config.flags.append(flag)""",
        "fix_diff": """```python
class PipelineConfig:
    def __init__(self, retries=3, flags=None):
        self.retries = retries
        # Fixed: Initialize new list per instance
        self.flags = flags if flags is not None else []
```"""
    }
]

def generate_dataset(output_path: str, count: int):
    # Synonyms to create variety in variable names
    var_names = ["items", "payloads", "elements", "jobs", "tasks", "records", "nodes"]
    domains = ["users", "profiles", "payments", "transactions", "invoices", "orders"]

    with open(output_path, 'w') as f:
        for i in range(count):
            template = random.choice(TEMPLATES)
            
            # Sub logic
            v = random.choice(var_names)
            d = random.choice(domains)
            
            p_diff = template["prompt_diff"].replace("users", d).replace("jobs", v).replace("books", v)
            f_diff = template["fix_diff"].replace("users", d).replace("jobs", v).replace("books", v)
            
            formatted_review = (
                f"[Issue]: {template['issue']}\n"
                f"[Impact]: {template['impact']}\n"
                f"[Fix (Code Diff)]:\n{f_diff}"
            )
            
            entry = {
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Please review this diff:\n{p_diff}"},
                    {"role": "assistant", "content": formatted_review}
                ]
            }
            f.write(json.dumps(entry) + "\n")

if __name__ == "__main__":
    generate_dataset("codesentinel_finetune_dataset.jsonl", 500)
    print(f"✅ Generated 500 JSONL entries in 'codesentinel_finetune_dataset.jsonl'.")
