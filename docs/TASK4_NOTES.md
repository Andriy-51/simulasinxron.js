Task 4 (BiDirectionalPriorityQueue) notes

Design notes:
- Uses per-priority doubly-linked lists to keep O(1) oldest/newest within a priority.
- Global doubly-linked list preserves insertion order for FIFO/LIFO.
- Avoids repeated array.splice on dequeue to prevent O(n^2) behavior.
