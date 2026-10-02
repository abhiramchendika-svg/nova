package dev.nova.developer.internship;

/** Where an application stands. Rejected and withdrawn are closed; the rest are still in play. */
public enum InternshipStatus {
    SAVED,
    APPLIED,
    ASSESSMENT,
    INTERVIEW,
    OFFER,
    REJECTED,
    WITHDRAWN;

    public boolean isClosed() {
        return this == REJECTED || this == WITHDRAWN;
    }
}
