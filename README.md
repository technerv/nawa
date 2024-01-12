# nawa
PROJECT: NEIGHBOURHOOD ALERT WATCH APPLICATION (NAWA)
- Secure and encrypted end to end application that sends alerts residents/neighbours of emerging security issues.
- Keep track of crime related data that occurs within a particular estate/area.
- Crime reporting tool that can send instant reports to various agencies e.g the police or relevant security agencies.
- Alerts will be in form of rapid SMS, immediate emergency in-calls with geo-location fencing addon features.
- Application will be divided into two mini apps 1. User App (for normal users who report daily crime incidences) 2. Agency App (recieves crime reports and act/respond accordingly to the specified crime).
- The application will be in both desktop and mobile (Android & iOS) platforms.

PROBLEM STATEMENT

Good security has always been a major factor when one considers to move into a new location residence. Most of the times, a potential neighbour who wishes to relocate to a new neighbourhood will mostly do some research work on how the area looks like, the feel of the area in terms of whether it is habitable, among many other factors.
However, there are various factors that once considers, top of the list will be the area security. This is important in the sense that some people intend to move in solo or with their families and live in for a long time.

One of the biggest challenges is getting enough security information (data) that can be used to make decisions on whether to stay or not. Most of the times the new neighbour will be told in vague how the area is secure, without having real knowledge of what happens in the ground.

Moreover whenever a security issue arise, the cases are rarely documented, some not involving the securty agencies who in turn fail to turn up in due time when the actual crime happens.

OBJECTIVES
There is need to properly document each security related issues in order to keep data that will be eventually be used whenever another issue arises.
The crime data can be shared across multiple security agencies in order to track and trace crimes where they happen and at what exact location.
Users can have the opportunity to register their bio data in order to use the platform.
Upon registration, each user will have the capacity to report crimes as they happen at a go.
Once a user has reported a crime, the data is shared across relevant security agencies who in turn will be able to act accordingly to the crime commited.
The application will be subdivided into two main components i.e. User App, Agency App 

**User App**
- Users will be able to register to the platform and input their respective bio details including (name, id, photo, area code, street)
- After registration to the platform, users will be able to submit crime related incidences as per their area code. Each report submitted to the app will be sent immediately to the Agency App that is run by the security agencies, who will receive the information from the respective users and their area codes.
- Every crime reported by the user will have a unique identifier number that will be exclusive for each case reported / stored in the database.

**Agency App**
- Security agencies will be able to register their details and also their
- To receive information of crime related incidences from users in the platform.
- Information submitted will be first verified by the agencies before any action proceed is taken.

TECHNOLOIGIES/PLATFORM

The project aims at developing both web application and mobile application. The following technologies that will be used in the process.
1. Front-end: React JS (Web App), React Native (Mobile App)
2. Back-end: Django (Python Framework)
3. API Endpoints: Graphql, Django REST Framework
4. Database: PostgreSQL
