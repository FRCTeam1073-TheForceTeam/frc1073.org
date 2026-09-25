---
layout: page
title: Software
permalink: /subgroupsoftware/
---

# Software

## Who We Are

The Software subgroup of Team 1073 works during the Competition and Off-Season to learn how to solve problems and program responsive mechanisms with the use of well-integrated and organized code. Even with each member having differing levels of knowledge, it is an environment where all can learn how to program from their starting level of knowledge and collaborate with others who may have more experience.

![Software Team]({{ site.baseurl }}/assets/images/subgroupsoftware-team.png)

## Programming Languages

Our subgroup uses a variety of programming languages to program both the robot's mechanisms and sensors, including our cameras and LiDAR. The main mechanisms and Drive Train of the robot are programmed in Java, while Python is used for LiDAR and most camera systems, such as OpenMV cameras. In the future, other camera systems may be programmed in C++.

## Design and Integration

FRC 1073's robot code is generally a simple command-based system, a control system is handled by continually looping default commands for each subsystem that waits for input from the Drivers to turn translate it into motor output. Software writes commands for each part of the mechanisms that we design separately and create command groups for automated functions, and reference the commands in the code that relates to all Driver-controlled functions. Since all commands are written separately, it is easy to test and edit commands without modifying other previously written code. We test code as frequently as possible and use GitHub to reduce initial code conflicts while building command groups.

## GitHub

The Software subgroup utilizes branches and pull request review procedures to keep our GitHub organized. Each team member that works on Java code uses their separate branch for their project. To merge a branch with the Master branch, every pull request must be reviewed and verified twice. Everyone on the team is encouraged to review pull requests, even just to learn from what other people have written. To keep the code further organized and efficient, a dedicated integrator and overseer position is being implemented.

## Java, Robot Code

Our Java code is structured using subsystems, commands, and command groups using the WPILib structure and superclasses. The robot code takes input from two Xbox controllers on the Driver Station, modifies the input with various filters (such as a deadzone), and then passes it to the motors on the robot, driving it around and using its other auxiliary features. The Java code takes care of initializing the network table, a way to transfer data from the robot to the Raspberry Pis, the Driver Station, the cameras on the robot, and other sensors.

When autonomous driving is needed, we create command groups that replicate controlled movement with only the need to set a distance and/or turning angle for each movement. This can either be assigned to a button on our Xbox controller or activated automatically during the autonomous portion of the match. Before the match, if we want to use one of these, we select it by choosing parameters from multiple lists, then the robot runs the command group that matches those parameters. Some years, when Software is given data over the field management system after the match starts, our robot will automatically fill in its own parameters based on the data it gets.

## UI

The Driver Station program is split into two major parts. The default Driver Station program was written in LabView, and is unmodified from the default program supplied by FIRST®. In the 2017-2018 season, the main dashboard program, which indicates information unique to that year's robot, was created using the SmartDashboard interface as part of the default FRC system. In the 2018-2019 season, a new dashboard system, titled SmarterDashboard, was written in JavaScript, using a custom server program written in Python. This lowers the barrier on creating customized dashboards, and increases the potential versatility of the dashboard.

## Vision Processing

Important data that Software gives to Drive Team during matches is vision processing data and a video stream. In past years, 1073 has used PixiCams and OpenMV cameras, both programmed in Python. The OpenMV cameras requires extra low-level byte-parsing software to make the device compatible with Raspberry Pis and Networktables, and proved to be worth the effort as the cameras could capture two different types of centering targets. Drive Team uses this data and video to place hatches in the 2018-2019 season. Both the PixiCams and OpenMV cameras were capable of detecting field elements through a filtered location-detecting program, and this was used to detect and autonomously drive to power cubes in the 2017-2018 season.

## LiDAR

1073 is the first team on the East Coast to implement a LiDAR sensor into our robot design. LiDAR works similarly to RaDAR, but, instead of sending out radio waves, it uses a concentrated infrared laser. It maps the distances it collects on a two-dimensional, circular map, giving a vague impression of its surroundings. We began to experiment with LiDAR during the 2018 Pre-Season and, so far, have created a collision-avoidance program, a line-detection algorithm, and a hatch alignment program that works in-tandem with the OpenMV cameras. We have since even begun experimenting with field navigation using the LiDAR. For the most part, it is still in development, but we hope to further explore the nearly infinite possibilities that come with this sensor. We received the Innovation in Control award for our before unseen use of LiDAR in the 2018 Official Competition Season.

## Bling

Bling refers to a strip of RGB LEDs, which can be controlled using a Raspberry Pi plugged into the robot. While Bling is usually used on robots for aesthetic purposes, 1073 uses Bling as a diagnostic tool during matches, allowing the Drive Team to determine the robot's current status by the pattern of colors. In previous seasons, the patterns, controlled across the robot's internal network from code programmed in Java, indicated what command the roboRIO was executing. In the 2018-2019 season, the final iteration of the Bling programming was changed to indicate the battery voltage, and was programmed in JavaScript as part of the new SmarterDashboard program.

## Scouting App

The Scouting App is a Java and Python programmed app created to use on tablets that allowed for our Scouters to easily enter data during matches and transfer it to spreadsheets. These spreadsheets then produce a statistical analysis on a robot's performance, such as a team's scoring averages or how successful their defense is. This information helps better project the outcome of matches, giving Team 1073 more effective strategies. The app provides a platform for quick and efficient data collection and is currently being developed to further increase the quality of our system.

## Off-Season Projects and Training

During the Off-Season, the Software subgroup works to enhance the code from the prior season, making it more reliable and organized to better teach incoming members how our code is implemented into the robot. Off-Season projects are based on the parts of the robot that students want to improve; what students are curious about and want to become familiar with; and what they think might be valuable for the upcoming season. Students use Off-Season projects to both gain more experience and improve their teaching skills. In the 2017-2018 Off-Season, a member of Software learned how to do RFID scanning and, for a time, implemented it onto a team attendance system. In the 2018-2019 Off-Season, the subgroup plans to implement odometry into the robot. Training is based around Java robot code, so each member of software has a basic understanding of how to program an FRC robot. They complete tasks to test their knowledge and abilities, like creating an autonomous program to make the robot drive and turning in a specific sequence. Software veterans work closely with new members to help teach, guide, and encourage them to challenge themselves and try new methods in the season and Off-Season. For coming years, Team 1073's Software team is creating an online Wiki and training program, so members of all subgroups and teams can easily learn more about software and programming.

## Goals

The overarching goal of The Force Team's Software subgroup is to give the best functionality to the mechanisms on the robot, while also providing as much data about the status of the robot to the Drive Team during matches. We do this through our sensors, cameras, autonomous programs, personally selected controls for the Driver and Operator, and use of LED diagnostics. The members of the subgroup strive to work with Electromechanical, Safety, Strategy, and Business to produce the best code for the team and the robot. In the 2018-2019 Off-Season, Software's goal is to implement velocity based input into the drive commands as well as encoders to pair and create odometry and closed-loop drive before Governor's Cup on September 28th. This precisely controlled way of driving the robot is hoped to be used in tandem with a new camera system run off of Jetson Nanos instead of Pis.
