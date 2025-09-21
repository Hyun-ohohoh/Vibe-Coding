// 전역 변수
let schedule = {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: []
};

let notificationInterval = null;
let isNotificationActive = false;

// 셔틀 시간표 데이터 (서버에서 가져옴)
let shuttleSchedule = {
    toSchool: [],
    toHome: []
};

// DOM 요소들
const daySelect = document.getElementById('daySelect');
const startHour = document.getElementById('startHour');
const startMinute = document.getElementById('startMinute');
const endHour = document.getElementById('endHour');
const endMinute = document.getElementById('endMinute');
const addClassBtn = document.getElementById('addClass');
const scheduleList = document.getElementById('scheduleList');
const clearScheduleBtn = document.getElementById('clearSchedule');
const startNotificationsBtn = document.getElementById('startNotifications');
const stopNotificationsBtn = document.getElementById('stopNotifications');
const testKakaoBtn = document.getElementById('testKakao');
const testShuttleBtn = document.getElementById('testShuttle');
const notificationStatus = document.getElementById('notificationStatus');
const nextNotifications = document.getElementById('nextNotifications');

// 이벤트 리스너 등록
addClassBtn.addEventListener('click', addClass);
clearScheduleBtn.addEventListener('click', clearSchedule);
startNotificationsBtn.addEventListener('click', startNotifications);
stopNotificationsBtn.addEventListener('click', stopNotifications);
testKakaoBtn.addEventListener('click', testKakaoNotification);
testShuttleBtn.addEventListener('click', testShuttleNotification);

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', function() {
    loadShuttleSchedule();
    updateScheduleDisplay();
    checkNotificationPermission();
});

// 서버에서 셔틀 시간표 로드
async function loadShuttleSchedule() {
    try {
        const response = await fetch('/api/shuttle-schedule');
        const data = await response.json();
        
        if (data.success) {
            shuttleSchedule = data.data;
            updateShuttleDisplay();
        }
    } catch (error) {
        console.error('셔틀 시간표 로드 오류:', error);
    }
}

// 셔틀 시간표 표시 업데이트
function updateShuttleDisplay() {
    const toSchoolElement = document.querySelector('.shuttle-direction:first-child .time-slots');
    const toHomeElement = document.querySelector('.shuttle-direction:last-child .time-slots');
    
    if (toSchoolElement && shuttleSchedule.toSchool) {
        toSchoolElement.innerHTML = shuttleSchedule.toSchool
            .map(time => `<span class="time-slot">${time}</span>`)
            .join('');
    }
    
    if (toHomeElement && shuttleSchedule.toHome) {
        toHomeElement.innerHTML = shuttleSchedule.toHome
            .map(time => `<span class="time-slot">${time}</span>`)
            .join('');
    }
}

// 수업 추가 함수
function addClass() {
    const day = daySelect.value;
    const startH = startHour.value;
    const startM = startMinute.value;
    const endH = endHour.value;
    const endM = endMinute.value;
    
    if (!startH || !startM || !endH || !endM) {
        alert('시작 시간과 종료 시간을 모두 선택해주세요.');
        return;
    }
    
    const start = `${startH}:${startM}`;
    const end = `${endH}:${endM}`;
    
    if (start >= end) {
        alert('종료 시간은 시작 시간보다 늦어야 합니다.');
        return;
    }
    
    const classData = {
        start: start,
        end: end,
        id: Date.now()
    };
    
    schedule[day].push(classData);
    updateScheduleDisplay();
    
    // 입력 필드 초기화
    startHour.value = '';
    startMinute.value = '';
    endHour.value = '';
    endMinute.value = '';
}

// 시간표 표시 업데이트
function updateScheduleDisplay() {
    scheduleList.innerHTML = '';
    
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const dayNames = ['월요일', '화요일', '수요일', '목요일', '금요일'];
    
    days.forEach((day, index) => {
        if (schedule[day].length > 0) {
            schedule[day].forEach(classData => {
                const item = document.createElement('div');
                item.className = 'schedule-item';
                item.innerHTML = `
                    <div class="schedule-item-info">
                        <div class="schedule-item-day">${dayNames[index]}</div>
                        <div class="schedule-item-time">${classData.start} - ${classData.end}</div>
                    </div>
                    <button class="delete-btn" onclick="deleteClass('${day}', ${classData.id})">삭제</button>
                `;
                scheduleList.appendChild(item);
            });
        }
    });
    
    if (scheduleList.children.length === 0) {
        scheduleList.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">등록된 수업이 없습니다.</p>';
    }
}

// 수업 삭제 함수
function deleteClass(day, id) {
    schedule[day] = schedule[day].filter(classData => classData.id !== id);
    updateScheduleDisplay();
}

// 전체 시간표 삭제
function clearSchedule() {
    if (confirm('모든 시간표를 삭제하시겠습니까?')) {
        Object.keys(schedule).forEach(day => {
            schedule[day] = [];
        });
        updateScheduleDisplay();
    }
}

// 알림 권한 확인
function checkNotificationPermission() {
    if ('Notification' in window) {
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }
}

// 알림 시작
function startNotifications() {
    if (!hasSchedule()) {
        alert('먼저 시간표를 입력해주세요.');
        return;
    }
    
    isNotificationActive = true;
    notificationStatus.className = 'status-active';
    notificationStatus.textContent = '✅ 알림이 활성화되었습니다';
    
    // 1분마다 알림 체크
    notificationInterval = setInterval(checkNotifications, 60000);
    
    // 즉시 한 번 체크
    checkNotifications();
    
    updateNotificationButtons();
}

// 알림 중지
function stopNotifications() {
    isNotificationActive = false;
    if (notificationInterval) {
        clearInterval(notificationInterval);
        notificationInterval = null;
    }
    
    notificationStatus.className = 'status-inactive';
    notificationStatus.textContent = '❌ 알림이 비활성화되었습니다';
    nextNotifications.innerHTML = '';
    
    updateNotificationButtons();
}

// 알림 버튼 상태 업데이트
function updateNotificationButtons() {
    startNotificationsBtn.disabled = isNotificationActive;
    stopNotificationsBtn.disabled = !isNotificationActive;
}

// 시간표가 있는지 확인
function hasSchedule() {
    return Object.values(schedule).some(daySchedule => daySchedule.length > 0);
}

// 알림 체크 함수
function checkNotifications() {
    if (!isNotificationActive) return;
    
    const now = new Date();
    const currentDay = getDayName(now.getDay());
    const currentTime = formatTime(now);
    
    const todaySchedule = schedule[currentDay];
    if (!todaySchedule || todaySchedule.length === 0) return;
    
    // 첫 수업과 마지막 수업 찾기
    const sortedSchedule = todaySchedule.sort((a, b) => a.start.localeCompare(b.start));
    const firstClass = sortedSchedule[0];
    const lastClass = sortedSchedule[sortedSchedule.length - 1];
    
    // 첫 수업 시작 전 알림 (수업 시간에 맞춰 탈 수 있는 셔틀 알림)
    const firstClassStart = firstClass.start;
    const tenMinutesBeforeFirst = subtractMinutes(firstClassStart, 10);
    if (shouldNotify(currentTime, tenMinutesBeforeFirst)) {
        const shuttles = findShuttles(firstClassStart, 'toSchool');
        showNotification('등교 셔틀 알림', `첫 수업 ${firstClassStart} 시작 전입니다!\n${shuttles.join(', ')} 셔틀이 있습니다.`);
    }
    
    // 마지막 수업 종료 후 알림 (수업 끝나고 탈 수 있는 셔틀 알림)
    const lastClassEnd = lastClass.end;
    const tenMinutesAfterLast = addMinutes(lastClassEnd, 10);
    if (shouldNotify(currentTime, tenMinutesAfterLast)) {
        const shuttles = findShuttles(lastClassEnd, 'toHome');
        showNotification('하교 셔틀 알림', `마지막 수업 ${lastClassEnd} 종료 후입니다!\n${shuttles.join(', ')} 셔틀이 있습니다.`);
    }
    
    // 다음 알림 예정 시간 표시
    updateNextNotifications(now, firstClass, lastClass);
}

// 시간 문자열에서 분 빼기
function subtractMinutes(timeStr, minutes) {
    const [hours, mins] = timeStr.split(':').map(Number);
    const totalMinutes = hours * 60 + mins - minutes;
    const newHours = Math.floor(totalMinutes / 60);
    const newMins = totalMinutes % 60;
    
    if (newHours < 0) {
        return '00:00';
    }
    
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
}

// 시간 문자열에 분 더하기
function addMinutes(timeStr, minutes) {
    const [hours, mins] = timeStr.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60);
    const newMins = totalMinutes % 60;
    
    // 24시간을 넘으면 다음 날로 넘어가므로 23:59로 제한
    if (newHours >= 24) {
        return '23:59';
    }
    
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
}

// 알림을 보낼 시간인지 확인 (현재 시간이 목표 시간과 5분 이내)
function shouldNotify(currentTime, targetTime) {
    const current = timeToMinutes(currentTime);
    const target = timeToMinutes(targetTime);
    const diff = Math.abs(current - target);
    
    // 테스트 모드: 모든 시간에 알림 표시 (토요일 테스트용)
    const isTestMode = window.location.search.includes('test=true');
    if (isTestMode) {
        return true;
    }
    
    return diff <= 5; // 5분 이내
}

// 시간 문자열을 분으로 변환
function timeToMinutes(timeStr) {
    const [hours, mins] = timeStr.split(':').map(Number);
    return hours * 60 + mins;
}

// 셔틀 시간 찾기
function findShuttles(targetTime, direction) {
    const shuttleTimes = shuttleSchedule[direction];
    const targetMinutes = timeToMinutes(targetTime);
    
    if (direction === 'toSchool') {
        // 등교: 수업 시간 전에 탈 수 있는 셔틀들 찾기
        const availableShuttles = shuttleTimes.filter(shuttleTime => {
            const shuttleMinutes = timeToMinutes(shuttleTime);
            return shuttleMinutes < targetMinutes; // 수업 시간보다 이른 셔틀들
        });
        
        // 수업 시간에 가장 가까운 2대 반환 (역순 정렬해서 가장 늦은 시간 2개)
        return availableShuttles.sort((a, b) => timeToMinutes(b) - timeToMinutes(a)).slice(0, 2);
    } else {
        // 하교: 수업 종료 후에 탈 수 있는 셔틀들 찾기
        const availableShuttles = shuttleTimes.filter(shuttleTime => {
            const shuttleMinutes = timeToMinutes(shuttleTime);
            return shuttleMinutes >= targetMinutes; // 수업 종료 시간 이후의 셔틀들
        });
        
        // 가장 가까운 2대 반환
        return availableShuttles.slice(0, 2);
    }
}

// 다음 알림 예정 시간 업데이트
function updateNextNotifications(now, firstClass, lastClass) {
    const currentDay = getDayName(now.getDay());
    const currentTime = formatTime(now);
    
    let nextNotificationsHtml = '<h4>📅 다음 알림 예정</h4>';
    
    // 첫 수업 알림
    const oneHourBefore = subtractMinutes(firstClass.start, 60);
    const firstShuttles = findShuttles(oneHourBefore, 'toSchool');
    nextNotificationsHtml += `
        <div class="notification-item">
            <div class="notification-time">등교 알림: ${oneHourBefore}</div>
            <div class="notification-message">첫 수업 시작 1시간 전 - ${firstShuttles.join(', ')}에 셔틀</div>
        </div>
    `;
    
    // 마지막 수업 알림
    const thirtyMinutesBefore = subtractMinutes(lastClass.end, 30);
    const lastShuttles = findShuttles(lastClass.end, 'toHome');
    nextNotificationsHtml += `
        <div class="notification-item">
            <div class="notification-time">하교 알림: ${thirtyMinutesBefore}</div>
            <div class="notification-message">마지막 수업 종료 30분 전 - ${lastShuttles.join(', ')}에 셔틀</div>
        </div>
    `;
    
    nextNotifications.innerHTML = nextNotificationsHtml;
}

// 브라우저 알림 표시
function showNotification(title, message) {
    if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification(title, {
            body: message,
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23667eea"><path d="M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 001 1h1a1 1 0 001-1v-1h8v1a1 1 0 001 1h1a1 1 0 001-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/></svg>'
        });
        
        notification.onclick = function() {
            window.focus();
            notification.close();
        };
        
        // 5초 후 자동으로 닫기
        setTimeout(() => {
            notification.close();
        }, 5000);
    }
    
    // 페이지 내 알림도 표시
    showPageNotification(title, message);
}

// 페이지 내 알림 표시
function showPageNotification(title, message) {
    const notificationDiv = document.createElement('div');
    notificationDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(45deg, #667eea, #764ba2);
        color: white;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        z-index: 1000;
        max-width: 300px;
        animation: slideIn 0.3s ease-out;
    `;
    
    notificationDiv.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 5px;">${title}</div>
        <div style="font-size: 14px; white-space: pre-line;">${message}</div>
    `;
    
    document.body.appendChild(notificationDiv);
    
    // 5초 후 제거
    setTimeout(() => {
        notificationDiv.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            document.body.removeChild(notificationDiv);
        }, 300);
    }, 5000);
}

// 요일 이름 반환
function getDayName(dayIndex) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[dayIndex];
}

// 시간 포맷팅
function formatTime(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

// 브라우저 알림 권한 요청
async function requestNotificationPermission() {
    if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('알림 권한이 허용되었습니다.');
            return true;
        } else {
            console.log('알림 권한이 거부되었습니다.');
            return false;
        }
    } else {
        console.log('이 브라우저는 알림을 지원하지 않습니다.');
        return false;
    }
}

// 실제 브라우저 알림 표시
function showBrowserNotification(title, message) {
    if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification(title, {
            body: message,
            icon: '🚌', // 이모지 아이콘
            badge: '🚌',
            tag: 'shuttle-notification',
            requireInteraction: true, // 사용자가 클릭할 때까지 유지
            silent: false
        });
        
        // 알림 클릭 시 브라우저 포커스
        notification.onclick = function() {
            window.focus();
            notification.close();
        };
        
        // 5초 후 자동으로 닫기
        setTimeout(() => {
            notification.close();
        }, 5000);
        
        return notification;
    } else {
        console.log('브라우저 알림을 사용할 수 없습니다.');
        return null;
    }
}

// 토요일 테스트용 알림
function testShuttleNotification() {
    // 알림 권한 확인
    if ('Notification' in window && Notification.permission === 'granted') {
        // 등교 알림 테스트 (9시 수업 예시)
        showBrowserNotification(
            '🚌 등교 셔틀 알림',
            '첫 수업 09:00 시작 전입니다!\n08:50, 08:40 셔틀이 있습니다.'
        );
        
        // 2초 후 하교 알림 테스트 (6시 수업 끝 예시)
        setTimeout(() => {
            showBrowserNotification(
                '🚌 하교 셔틀 알림', 
                '마지막 수업 18:00 종료 후입니다!\n18:10, 18:20 셔틀이 있습니다.'
            );
        }, 2000);
        
        showPageNotification('✅ 알림 테스트', '등교/하교 알림이 2초 간격으로 표시됩니다!');
    } else {
        showPageNotification('❌ 알림 권한 필요', '브라우저 알림 권한을 허용해주세요.');
    }
}

// 카카오톡 알림 테스트
async function testKakaoNotification() {
    try {
        // 먼저 알림 권한 요청
        const hasPermission = await requestNotificationPermission();
        
        const response = await fetch('/api/test-kakao', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: '🚌 셔틀 알림 테스트',
                message: '카카오톡 알림이 정상적으로 작동합니다!\n\n등교 시간: 08:15, 08:20\n하교 시간: 12:30, 12:45'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showPageNotification('✅ 카카오톡 테스트 성공', '터미널에서 카카오톡 알림 로그를 확인하세요!');
            
            // 브라우저 알림도 표시
            if (hasPermission) {
                showBrowserNotification(
                    '🚌 셔틀 알림 테스트',
                    '카카오톡 알림이 정상적으로 작동합니다!\n등교 시간: 08:15, 08:20\n하교 시간: 12:30, 12:45'
                );
            }
        } else {
            showPageNotification('❌ 카카오톡 테스트 실패', data.message);
        }
    } catch (error) {
        console.error('카카오톡 테스트 오류:', error);
        showPageNotification('❌ 카카오톡 테스트 오류', '서버 연결에 실패했습니다.');
    }
}

// CSS 애니메이션 추가
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;

// =======================================================
// 아래 코드를 script.js 파일 맨 아래에 추가하세요
// =======================================================

// 1. 새로 만든 버튼을 변수에 할당
const calculateOnServerBtn = document.getElementById('calculateOnServerBtn');

// 2. 버튼에 클릭 이벤트 연결
calculateOnServerBtn.addEventListener('click', calculateOnServer);

// 3. 서버에 데이터를 보내는 새로운 함수
async function calculateOnServer() {
    console.log("서버로 알림 계산을 요청합니다...");
    console.log("현재 시간표:", schedule);

    if (!hasSchedule()) {
        alert('먼저 시간표를 입력해주세요.');
        return;
    }

    try {
        const response = await fetch('/api/calculate-notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ schedule: schedule }) // 시간표 데이터를 body에 담아 전송
        });

        const data = await response.json();

        if (data.success) {
            console.log("서버로부터 받은 알림:", data.notifications);
            alert('서버에서 알림 계산 성공! 터미널 로그를 확인하세요.');
        } else {
            console.error("서버 오류:", data.message);
            alert('서버에서 오류가 발생했습니다.');
        }
    } catch (error) {
        console.error('서버 통신 오류:', error);
        alert('서버와 통신하는 데 실패했습니다.');
    }
}
document.head.appendChild(style);
