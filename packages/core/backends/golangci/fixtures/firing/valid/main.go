// Fixture: valid — same need served via an injected accessor (no os.Getenv call, no //permit:
// directive). This is the refactor the ban exists to push toward (kickoff §2 step 6 + fork
// resolution #6 — plain refactor, no directive whose existence in v1.55.2 cannot be verified
// from inside the aif container).
package main

func main() {
	_ = getConfig("HOME")
}

// getConfig is the injected accessor the ban pushes callers toward. Stub implementation —
// the fixtures exist to prove firing, not to model a real configuration surface.
func getConfig(key string) string {
	return ""
}
