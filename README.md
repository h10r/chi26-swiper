# CHI Swipe Scheduler

CHI Swipe Scheduler is a web application for reviewing CHI 2026 papers and building a personal conference schedule.

The application presents papers in a swipe-based interface that supports quick triage. Users can decide whether to skip a paper, mark it for later reading, or add it to their conference schedule. Selected items can then be exported as an iCalendar (`.ics`) file for import into standard calendar applications.

## Purpose

Preparing a personal schedule for CHI often requires reviewing a large number of papers across sessions and tracks. This project was built to simplify that process and provide a more efficient alternative to manually managing tabs, notes, or spreadsheets.

## Features

- Browse CHI 2026 papers in a card-based interface
- Classify papers through simple actions such as pass, read, or attend
- Review papers one at a time to support fast decision-making
- Export selected papers and sessions as an iCalendar (`.ics`) file
- Import the exported schedule into calendar applications such as Google Calendar, Apple Calendar, or Outlook

## Links

- Tool: https://hen-drik.de/chi26-swiper/

## How it works

1. The application loads CHI 2026 papers and their scheduling metadata.
2. Papers are shown individually in a swipe-oriented interface.
3. The user assigns a decision to each paper.
4. Papers marked for attendance are collected into a personal schedule.
5. The schedule can be exported as an iCalendar (`.ics`) file.

## iCalendar export

The exported `.ics` file is intended for use with standard calendar clients. Each event includes the basic information needed for conference planning, such as title, time, and location.
