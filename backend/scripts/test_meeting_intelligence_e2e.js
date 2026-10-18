const http = require('http');
const fs = require('fs');
const XLSX = require('xlsx');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const contentType = res.headers['content-type'] || '';
        if (contentType.includes('application/json')) {
          try {
            const parsed = JSON.parse(buffer.toString('utf8'));
            if (res.statusCode >= 400) {
              return reject({ status: res.statusCode, body: parsed });
            }
            return resolve(parsed);
          } catch (e) {
            return reject({ status: res.statusCode, body: buffer.toString('utf8') });
          }
        }
        resolve({ status: res.statusCode, buffer, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (data) {
      if (typeof data === 'string') {
        req.write(data);
      } else {
        req.write(JSON.stringify(data));
      }
    }
    req.end();
  });
}

async function runTest() {
  console.log('=== STARTING BDIQ MEETING INTELLIGENCE TEST WORKFLOW ===\n');

  // 1. Create meeting
  console.log('Step 1: Creating meeting with Microsoft Teams conferencing link...');
  const createPayload = {
    title: 'Novo Nordisk Semaglutide Formulation Batch Feasibility Review',
    meeting_date: new Date().toISOString().split('T')[0],
    meeting_time: '14:00:00',
    end_time: '15:00:00',
    timezone: 'Asia/Kolkata',
    meeting_type: 'Technical Discussion',
    location_or_link: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_semaglutide_batch_01%40thread.v2/0',
    objective: 'Confirm pilot batch excipient compatibility and validate commercial manufacturing timetable.',
    expected_outcomes: '1. Agree on formulation excipient specs.\n2. Confirm regulatory submission dates.\n3. Create canonical execution tasks.',
    agenda: '1. Review previous meeting actions\n2. Formulation stability & excipient compatibility\n3. Action item assignments & deadlines',
    external_organizations: 'Novo Nordisk A/S'
  };

  const meeting = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/meetings',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer dev-admin-token'
    }
  }, createPayload);

  console.log('✓ Meeting Created:', {
    id: meeting.id,
    code: meeting.meeting_code,
    title: meeting.title,
    status: meeting.status,
    location_or_link: meeting.location_or_link,
    platform: meeting.platform
  });

  if (!meeting.location_or_link || !meeting.location_or_link.includes('teams.microsoft.com')) {
    throw new Error('Assertion failed: meeting.location_or_link was not saved correctly!');
  }

  // 2. Start Meeting
  console.log('\nStep 2: Starting meeting...');
  const started = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/api/meetings/${meeting.id}/start`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer dev-admin-token'
    }
  });

  console.log('✓ Meeting Started:', {
    id: started.id,
    status: started.status,
    actual_start_time: started.actual_start_time,
    started_by: started.started_by,
    launch_url: started.launch_url
  });

  if (started.status !== 'IN_PROGRESS' || !started.actual_start_time) {
    throw new Error('Assertion failed: meeting status is not IN_PROGRESS or actual_start_time is missing!');
  }

  // 3. Mini Notes Capture
  console.log('\nStep 3: Capturing Live Mini Notes...');
  const note1 = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/api/meetings/${meeting.id}/notes`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer dev-admin-token'
    }
  }, {
    content: 'Dr. Aris (Novo Nordisk): Pilot stability testing shows 99.4% purity under refrigerated conditions.',
    speaker: 'Dr. Aris (Novo Nordisk)',
    note_type: 'DISCUSSION',
    agenda_item: 'Formulation stability & excipient compatibility'
  });

  const note2 = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/api/meetings/${meeting.id}/notes`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer dev-admin-token'
    }
  }, {
    content: 'Quality team must finalize analytical method validation protocol by Friday.',
    speaker: 'Quality Assurance',
    note_type: 'ACTION',
    agenda_item: 'Action item assignments & deadlines'
  });

  console.log('✓ Captured 2 notes:', [note1.content, note2.content]);

  // 4. Create Structured Point
  console.log('\nStep 4: Recording Structured Meeting Point...');
  const point = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/api/meetings/${meeting.id}/points`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer dev-admin-token'
    }
  }, {
    title: 'Finalize Semaglutide Analytical Method Validation Protocol',
    category: 'ACTION',
    priority: 'HIGH',
    due_date: '2026-10-25',
    action_required: true,
    discussion_notes: 'Protocol drafted; requires QA director sign-off before pilot batch compounding.'
  });

  console.log('✓ Meeting Point Recorded:', {
    id: point.id,
    code: point.point_code,
    title: point.title,
    priority: point.priority,
    due_date: point.due_date
  });

  // 5. Convert Point to Canonical Task
  console.log('\nStep 5: Converting Point to Canonical Task...');
  const task = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/api/meetings/${meeting.id}/points/${point.id}/create-task`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer dev-admin-token'
    }
  }, {
    title: point.title,
    description: point.discussion_notes,
    priority: 'HIGH',
    due_date: '2026-10-25'
  });

  console.log('✓ Canonical Task Created & Linked:', {
    id: task.id,
    task_code: task.task_code,
    title: task.title,
    status: task.status
  });

  if (!task.id) {
    throw new Error('Assertion failed: Task creation failed to return task ID!');
  }

  // Verify Deduplication on repeat request
  const repeatTask = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/api/meetings/${meeting.id}/points/${point.id}/create-task`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer dev-admin-token'
    }
  }, {});

  if (repeatTask.id !== task.id) {
    throw new Error('Assertion failed: Repeat task creation did not deduplicate!');
  }
  console.log('✓ Deduplication verified: repeat request returned existing task ID:', repeatTask.id);

  // 6. Record & Confirm Decision
  console.log('\nStep 6: Recording & Confirming Formal Decision...');
  const decision = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/api/meetings/${meeting.id}/decisions`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer dev-admin-token'
    }
  }, {
    title: 'Approved 500L pilot batch formulation schedule for November 2026',
    description: 'Technical consensus reached with client sponsor.',
    impact: 'HIGH',
    rationale: 'Stability profile verified; facility suite available.'
  });

  const confirmedDec = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/api/meetings/decisions/${decision.id}/confirm`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer dev-admin-token'
    }
  }, { is_confirmed: true });

  console.log('✓ Decision Recorded and Confirmed:', {
    code: confirmedDec.decision_code,
    title: confirmedDec.title,
    is_confirmed: confirmedDec.is_confirmed,
    confirmed_at: confirmedDec.confirmed_at
  });

  // 7. End Meeting
  console.log('\nStep 7: Ending meeting session...');
  const ended = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/api/meetings/${meeting.id}/end`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer dev-admin-token'
    }
  });

  console.log('✓ Meeting Ended:', {
    status: ended.status,
    actual_end_time: ended.actual_end_time,
    summary: ended.session_summary
  });

  if (ended.status !== 'AWAITING_MOM_REVIEW') {
    throw new Error('Assertion failed: meeting status is not AWAITING_MOM_REVIEW after end!');
  }

  // 8. Generate MOM Draft
  console.log('\nStep 8: Generating Minutes of Meeting Draft (18 sections)...');
  const mom = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/api/meetings/${meeting.id}/mom/generate`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer dev-admin-token'
    }
  }, {});

  console.log('✓ MOM Draft Generated:', {
    mom_status: mom.mom_status,
    mom_version: mom.mom_version,
    textPreview: (mom.mom_text || '').substring(0, 150) + '...'
  });

  // 9. Confirm MOM
  console.log('\nStep 9: Confirming and approving MOM...');
  const confirmedMOM = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/api/meetings/${meeting.id}/mom/confirm`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer dev-admin-token'
    }
  }, {
    mom_text: mom.mom_text,
    executive_summary: 'Formulation feasibility successfully confirmed with committed delivery dates.'
  });

  console.log('✓ Meeting Completed with Confirmed MOM:', {
    status: confirmedMOM.status,
    mom_status: confirmedMOM.mom_status,
    closure_status: confirmedMOM.closure_status,
    minutes_approved: confirmedMOM.minutes_approved
  });

  if (confirmedMOM.status !== 'COMPLETED' || confirmedMOM.mom_status !== 'CONFIRMED') {
    throw new Error('Assertion failed: meeting did not transition to COMPLETED / CONFIRMED!');
  }

  // 10. Export Excel Workbook
  console.log('\nStep 10: Downloading & Verifying Excel Workbook...');
  const excelRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/api/meetings/${meeting.id}/export/excel`,
    method: 'GET',
    headers: {
      'Authorization': 'Bearer dev-admin-token'
    }
  });

  console.log('✓ Excel Response Status:', excelRes.status);
  console.log('✓ Content-Type:', excelRes.headers['content-type']);
  console.log('✓ Content-Disposition:', excelRes.headers['content-disposition']);
  console.log('✓ Buffer Size:', excelRes.buffer.length, 'bytes');

  // Parse with XLSX to verify all 7 worksheets
  const wb = XLSX.read(excelRes.buffer, { type: 'buffer' });
  console.log('✓ Worksheets Found in Excel Workbook:', wb.SheetNames);

  const expectedSheets = [
    'MOM Summary',
    'Meeting Details',
    'Agenda and Discussion',
    'Confirmed Decisions',
    'Action Items',
    'Risks and Pending Items',
    'Source Notes'
  ];

  for (const sheet of expectedSheets) {
    if (!wb.SheetNames.includes(sheet)) {
      throw new Error(`Missing expected sheet in Excel workbook: ${sheet}`);
    }
  }

  console.log('\n=== ALL 10 PHASES OF MEETING INTELLIGENCE TEST PASSED! ===');
}

runTest().catch(err => {
  console.error('\nTEST FAILED:', err);
  process.exit(1);
});
