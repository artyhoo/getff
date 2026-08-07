// Fixture: invalid — calls the banned API; forbidigo MUST fire.
package main

import "os"

func main() {
	_ = os.Getenv("HOME")
}
