import { newTask } from './logic.js';

function shift(today, days) {
  const [y, m, d] = today.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Sample tasks for trying the app in demo mode. Dates are relative to today so every urgency colour shows. */
export function sampleTasks(today) {
  const mk = (title, status, type, project, priority, off, pts) =>
    newTask({ title, status, type, project, priority, dueDate: off === null ? '' : shift(today, off), startDate: off === null ? '' : shift(today, off - 5), storyPoints: pts });
  const list = [
    mk('Explore vector search POC', 'Backlog', 'POC', 'Research', 'Low', null, 5),
    mk('Draft team wiki page', 'Backlog', 'Admin', 'Internal', 'Medium', 27, 2),
    mk('Plan upskilling topics', 'Backlog', 'Upskilling', 'Learning', 'Low', 18, 1),
    mk('Prepare sprint demo deck', 'To Do', 'Project', 'Sample project', 'High', 1, 3),
    mk('Submit monthly timesheet', 'To Do', 'Admin', 'Timesheet', 'Medium', 2, 1),
    mk('Write model tests', 'To Do', 'Project', 'Sample project', 'Medium', 6, 5),
    mk('Fix load failure', 'In Progress', 'Project', 'Sample project', 'Critical', -3, 5),
    mk('Learn workflow basics', 'In Progress', 'Upskilling', 'Learning', 'Medium', 5, 3),
    mk('Customer churn POC', 'In Progress', 'POC', 'Research', 'High', 15, 8),
    mk('Refactor staging models', 'In Review', 'Project', 'Sample project', 'High', 4, 5),
    mk('Access request: prod schema', 'Blocked', 'Admin', 'Sample project', 'High', -1, 1),
    mk('Weekly status report', 'Done', 'Admin', 'Internal', 'Low', -2, 1),
    mk('Fix date parsing bug', 'Done', 'Project', 'Sample project', 'Medium', -4, 2)
  ];
  const first = list.find((t) => t.title === 'Prepare sprint demo deck');
  first.checklist = [
    { id: 'c1', text: 'Pull sprint numbers', done: true },
    { id: 'c2', text: 'Outline the story', done: true },
    { id: 'c3', text: 'Build the slides', done: false }
  ];
  first.notes = 'Keep it to five slides.';
  list.push(newTask({ title: 'Collect pipeline metrics', status: 'Done', type: 'Project', project: 'Sample project', parentId: first.id, priority: 'High' }));
  list.push(newTask({ title: 'Draft slides', status: 'In Progress', type: 'Project', project: 'Sample project', parentId: first.id, priority: 'High' }));
  for (const t of list) if (t.status === 'Done') t.completedAt = new Date().toISOString();
  return list;
}
