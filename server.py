#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from datetime import datetime, timedelta
import os
import requests
import json
from dotenv import load_dotenv

# 환경 변수 로드
load_dotenv()

app = Flask(__name__)
CORS(app)

# 셔틀 시간표 데이터 (백엔드에서 관리)
shuttle_schedule = {
    'toSchool': [
        # 오전 시간표 (진입로경유 예정 시간)
        '08:15', '08:20', '08:30', '08:35', '08:40', '08:50', '09:00', '09:05', '09:15', '09:30', 
        '09:40', '09:45', '09:50', '09:55', '10:10', '10:15', '10:35', '10:45', '10:55', '11:00', 
        '11:15', '11:25', '11:40', '11:45', '12:00', '12:10', '12:20', '12:35', '12:45', '13:00',
        # 오후 시간표 (진입로경유 예정 시간)
        '13:15', '13:25', '13:40', '13:55', '14:10', '14:25', '14:35', '14:50', '15:05', '15:20',
        '15:35', '15:50', '16:05', '16:20', '16:35', '16:50', '17:05', '17:20', '17:35', '17:50',
        '18:05', '18:20', '18:35', '18:50', '19:05', '19:20', '19:35', '19:50', '20:05', '20:15'
    ],
    'toHome': [
        # 오전 시간표 (출발 시각)
        '08:00', '08:05', '08:15', '08:20', '08:25', '08:35', '08:45', '08:50', '08:55', '09:00', 
        '09:15', '09:25', '09:30', '09:35', '09:40', '09:55', '10:00', '10:20', '10:30', '10:40', 
        '10:45', '11:00', '11:20', '11:25', '11:30', '11:45', '11:55', '12:05', '12:20', '12:30', '12:45',
        # 오후 시간표 (출발 시각)
        '13:00', '13:10', '13:25', '13:40', '13:55', '14:10', '14:20', '14:35', '14:50', '15:05',
        '15:20', '15:35', '15:50', '16:05', '16:20', '16:35', '16:50', '17:05', '17:20', '17:35',
        '17:50', '18:05', '18:20', '18:35', '18:50', '19:05', '19:20', '19:35', '19:50', '20:00'
    ],
    # 운행 구분별 시간표
    'myeongjiStation': {
        'toSchool': [
            # 명지대역 등교 시간 (진입로경유 예정 시간)
            '08:15', '08:30', '08:35', '08:40', '08:50', '09:00', '09:05', '09:15', '09:30', 
            '09:40', '09:45', '09:50', '09:55', '10:15', '10:35', '10:45', '10:55', '11:00', 
            '11:15', '11:25', '11:40', '11:45', '12:00', '12:10', '12:20', '12:35', '12:45', '13:00',
            '13:15', '13:25', '13:40', '13:55', '14:10', '14:25', '14:50', '15:05', '15:20',
            '15:35', '15:50', '16:05', '16:20', '16:35', '16:50', '17:05', '17:20', '17:35', '17:50',
            '18:05', '18:20', '18:35', '18:50', '19:05', '19:20', '19:35', '19:50', '20:05', '20:15'
        ],
        'toHome': [
            # 명지대역 하교 시간 (출발 시각)
            '08:00', '08:15', '08:20', '08:25', '08:35', '08:45', '08:50', '08:55', '09:00', 
            '09:15', '09:25', '09:30', '09:35', '09:40', '09:55', '10:00', '10:20', '10:30', 
            '10:40', '10:45', '11:00', '11:25', '11:30', '11:45', '11:55', '12:05', '12:20', '12:30', '12:45',
            '13:00', '13:10', '13:25', '13:40', '13:55', '14:10', '14:20', '14:35', '14:50', '15:05',
            '15:20', '15:35', '15:50', '16:05', '16:20', '16:35', '16:50', '17:05', '17:20', '17:35',
            '17:50', '18:05', '18:20', '18:35', '18:50', '19:05', '19:20', '19:35', '19:50', '20:00'
        ]
    },
    'downtown': {
        'toSchool': [
            # 시내 등교 시간 (진입로경유 예정 시간)
            '08:20', '09:10', '10:25', '11:35', '13:25', '14:35', '15:55', '16:50', '18:25', '20:15'
        ],
        'toHome': [
            # 시내 하교 시간 (출발 시각)
            '08:05', '08:55', '10:10', '11:20', '13:10', '14:20', '15:40', '16:35', '18:10', '20:00'
        ]
    }
}

def time_to_minutes(time_str):
    """시간 문자열을 분으로 변환"""
    hours, minutes = map(int, time_str.split(':'))
    return hours * 60 + minutes

def minutes_to_time(minutes):
    """분을 시간 문자열로 변환"""
    hours = minutes // 60
    mins = minutes % 60
    return f"{hours:02d}:{mins:02d}"

def subtract_minutes(time_str, minutes):
    """시간 문자열에서 분 빼기"""
    total_minutes = time_to_minutes(time_str) - minutes
    if total_minutes < 0:
        return '00:00'
    return minutes_to_time(total_minutes)

def find_nearest_shuttles(target_time, direction, count=2):
    """가장 가까운 셔틀 찾기"""
    shuttle_times = shuttle_schedule[direction]
    target_minutes = time_to_minutes(target_time)
    
    # 목표 시간 이후의 셔틀들 찾기
    available_shuttles = [shuttle_time for shuttle_time in shuttle_times 
                         if time_to_minutes(shuttle_time) >= target_minutes]
    
    # 가장 가까운 셔틀들 반환
    return available_shuttles[:count]

# 카카오톡 알림 관련 함수들
def send_kakao_notification(phone_number, title, message):
    """카카오톡 알림톡 전송 (실제 API 호출)"""
    try:
        # 환경 변수에서 설정 가져오기
        rest_api_key = os.getenv('KAKAO_REST_API_KEY')
        sender_key = os.getenv('KAKAO_SENDER_KEY')
        template_code = os.getenv('KAKAO_TEMPLATE_CODE')
        
        if not all([rest_api_key, sender_key, template_code]):
            print("❌ 카카오톡 API 설정이 완료되지 않았습니다.")
            print(f"   REST_API_KEY: {'✅' if rest_api_key else '❌'}")
            print(f"   SENDER_KEY: {'✅' if sender_key else '❌'}")
            print(f"   TEMPLATE_CODE: {'✅' if template_code else '❌'}")
            return False
        
        # 카카오톡 알림톡 API URL
        url = "https://kapi.kakao.com/v2/api/talk/memo/default/send"
        
        # 헤더 설정
        headers = {
            'Authorization': f'Bearer {rest_api_key}',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        
        # 메시지 데이터
        data = {
            'template_object': json.dumps({
                'object_type': 'text',
                'text': f"{title}\n\n{message}",
                'link': {
                    'web_url': 'http://localhost:3000',
                    'mobile_web_url': 'http://localhost:3000'
                },
                'button_title': '앱으로 이동'
            })
        }
        
        response = requests.post(url, headers=headers, data=data)
        
        if response.status_code == 200:
            print(f"✅ 카카오톡 알림 전송 성공: {title}")
            return True
        else:
            print(f"❌ 카카오톡 알림 전송 실패: {response.status_code}")
            print(f"   응답: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ 카카오톡 알림 전송 오류: {e}")
        return False

def send_simple_kakao_message(title, message):
    """간단한 카카오톡 메시지 전송 (테스트용)"""
    try:
        # 실제로는 카카오톡 알림톡 API를 사용해야 하지만,
        # 개발 단계에서는 로그로 대체
        print("=" * 50)
        print("🚌 카카오톡 알림")
        print(f"제목: {title}")
        print(f"내용: {message}")
        print("=" * 50)
        return True
    except Exception as e:
        print(f"카카오톡 메시지 전송 오류: {e}")
        return False

# API 엔드포인트들

@app.route('/api/shuttle-schedule', methods=['GET'])
def get_shuttle_schedule():
    """셔틀 시간표 조회"""
    return jsonify({
        'success': True,
        'data': shuttle_schedule
    })

@app.route('/api/shuttle-schedule', methods=['PUT'])
def update_shuttle_schedule():
    """셔틀 시간표 업데이트 (관리자용)"""
    data = request.get_json()
    
    if 'toSchool' in data:
        shuttle_schedule['toSchool'] = data['toSchool']
    if 'toHome' in data:
        shuttle_schedule['toHome'] = data['toHome']
    
    return jsonify({
        'success': True,
        'message': '셔틀 시간표가 업데이트되었습니다.',
        'data': shuttle_schedule
    })

@app.route('/api/calculate-notifications', methods=['POST'])
def calculate_notifications():
    """알림 계산 API (수정된 로직)"""
    try:
        data = request.get_json()
        schedule_data = data.get('schedule', {})

        if not schedule_data:
            return jsonify({'success': False, 'message': '시간표가 입력되지 않았습니다.'}), 400

        notifications = []

        # --- 테스트를 위한 시간 강제 설정 ---
        # 실제 운영 시에는 아래 두 줄을 주석 처리하고, now = datetime.now()를 사용하세요.
        #now = datetime(2025, 9, 15, 8, 0, 0)  # 예: '월요일 오전 8시 00분'으로 시간 고정
        #print(f"--- 테스트 모드: 현재 시간을 {now.strftime('%Y-%m-%d %H:%M:%S')}로 설정 ---")
        now = datetime.now() # 실제 운영 시 이 줄의 주석을 해제하세요.
        # -----------------------------------

        current_day_str = now.strftime('%A').lower()
        current_time_str = now.strftime('%H:%M')

        today_schedule = schedule_data.get(current_day_str)

        if not today_schedule:
            return jsonify({'success': True, 'message': '오늘은 수업이 없습니다.', 'notifications': []})

        sorted_schedule = sorted(today_schedule, key=lambda x: x['start'])
        first_class = sorted_schedule[0]
        last_class = sorted_schedule[-1]

        # === 등교 알림 계산 ===
        # 1. 알림이 울려야 하는 시간 (수업 1시간 전)
        notification_trigger_time = subtract_minutes(first_class['start'], 60)

        # 2. 추천할 셔틀 찾기: 수업 시작 시간 '이전'에 오는 모든 등교 셔틀을 찾습니다.
        to_school_times = shuttle_schedule['toSchool']
        class_start_minutes = time_to_minutes(first_class['start'])
        available_shuttles = [t for t in to_school_times if time_to_minutes(t) < class_start_minutes]

        # 3. 찾은 셔틀들을 시간 역순으로 정렬해서 가장 늦게 출발하는 2개를 고릅니다.
        available_shuttles.sort(key=time_to_minutes, reverse=True)
        morning_shuttles = available_shuttles[:2]

        if morning_shuttles:
            morning_notification = {
                'type': 'morning',
                'title': '등교 셔틀 알림',
                'message': f"첫 수업({first_class['start']})에 늦지 않게 타야 할 마지막 셔틀은 {', '.join(morning_shuttles)} 입니다.",
                'time': notification_trigger_time,  # 알림은 수업 1시간 전에 울립니다.
                'shuttles': morning_shuttles,
                'originalTime': first_class['start']
            }
            notifications.append(morning_notification)

        # === [기존 로직 유지] 하교 알림 계산 ===
        evening_shuttles = find_nearest_shuttles(last_class['end'], 'toHome')

        if evening_shuttles:
            evening_notification = {
                'type': 'evening',
                'title': '하교 셔틀 알림',
                'message': f"마지막 수업({last_class['end']}) 종료 후 탈 수 있는 가장 빠른 셔틀은 {', '.join(evening_shuttles)} 입니다.",
                'time': last_class['end'],
                'shuttles': evening_shuttles,
                'originalTime': last_class['end']
            }
            notifications.append(evening_notification)

        # 카카오톡 알림 전송 (테스트용)
        for notification in notifications:
            send_simple_kakao_message(notification['title'], notification['message'])

        return jsonify({
            'success': True,
            'notifications': notifications,
            'currentTime': current_time_str,
            'todaySchedule': today_schedule
        })

    except Exception as error:
        print(f'알림 계산 오류: {error}')
        return jsonify({'success': False, 'message': '알림 계산 중 오류가 발생했습니다.'}), 500

@app.route('/api/test-kakao', methods=['POST'])
def test_kakao_notification():
    """카카오톡 알림 테스트"""
    try:
        data = request.get_json()
        title = data.get('title', '테스트 알림')
        message = data.get('message', '카카오톡 알림 테스트입니다.')
        
        # 먼저 터미널에 로그 출력
        result = send_simple_kakao_message(title, message)
        
        # 실제 카카오톡 API 호출 시도
        # 주의: 실제 전송을 위해서는 사용자 인증이 필요합니다
        api_result = send_kakao_notification("01000000000", title, message)
        
        return jsonify({
            'success': result,
            'api_success': api_result,
            'message': '카카오톡 알림 테스트가 완료되었습니다.',
            'note': '실제 전송을 위해서는 사용자 인증이 필요합니다.'
        })
        
    except Exception as error:
        print(f'카카오톡 테스트 오류: {error}')
        return jsonify({
            'success': False,
            'message': '카카오톡 알림 테스트 중 오류가 발생했습니다.'
        }), 500

@app.route('/api/check-notifications', methods=['POST'])
def check_notifications():
    """현재 시간 기준 알림 체크"""
    try:
        data = request.get_json()
        schedule = data.get('schedule', {})
        now = datetime.now()
        current_time = now.strftime('%H:%M')
        
        # 알림 계산
        response_data = {
            'success': True,
            'notifications': [],
            'currentTime': current_time
        }
        
        # 5분 이내 알림인지 확인
        def should_notify(target_time):
            current = time_to_minutes(current_time)
            target = time_to_minutes(target_time)
            diff = abs(current - target)
            return diff <= 5
        
        # 첫 수업 알림 체크
        first_class_start = schedule.get('firstClass', {}).get('start', '09:00')
        one_hour_before = subtract_minutes(first_class_start, 60)
        if should_notify(one_hour_before):
            shuttles = find_nearest_shuttles(one_hour_before, 'toSchool')
            response_data['notifications'].append({
                'type': 'morning',
                'title': '등교 셔틀 알림',
                'message': f"첫 수업 시작 1시간 전입니다! {', '.join(shuttles)}에 셔틀이 있습니다.",
                'urgent': True
            })
        
        # 마지막 수업 알림 체크
        last_class_end = schedule.get('lastClass', {}).get('end', '18:00')
        thirty_minutes_before = subtract_minutes(last_class_end, 30)
        if should_notify(thirty_minutes_before):
            shuttles = find_nearest_shuttles(last_class_end, 'toHome')
            response_data['notifications'].append({
                'type': 'evening',
                'title': '하교 셔틀 알림',
                'message': f"마지막 수업 종료 30분 전입니다! {', '.join(shuttles)}에 셔틀이 있습니다.",
                'urgent': True
            })
        
        return jsonify(response_data)
        
    except Exception as error:
        print(f'알림 체크 오류: {error}')
        return jsonify({
            'success': False,
            'message': '알림 체크 중 오류가 발생했습니다.'
        }), 500

# 정적 파일 서빙 (프론트엔드)
@app.route('/')
def index():
    return send_from_directory('public', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('public', filename)

if __name__ == '__main__':
    port = 3000  # 포트 3000으로 복원
    print("🚌 셔틀 알림 서비스가 포트 3000에서 실행 중입니다.")
    print("📱 브라우저에서 http://localhost:3000 를 열어주세요.")
    app.run(host='127.0.0.1', port=port, debug=True)
