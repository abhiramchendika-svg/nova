package dev.nova.planner.task;

public enum TaskStatus {
    TODO,
    IN_PROGRESS,
    DONE;

    public boolean isOpen() {
        return this != DONE;
    }
}
