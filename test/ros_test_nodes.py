#!/usr/bin/env python3
"""
ROS2 test nodes for ros-panel integration tests.
Provides a topic publisher, service server, and action server.
"""
import time
import rclpy
from rclpy.node import Node
from rclpy.action import ActionServer
from rclpy.executors import MultiThreadedExecutor
from std_msgs.msg import String
from std_srvs.srv import SetBool
from example_interfaces.action import Fibonacci


class TestNodes(Node):
    def __init__(self):
        super().__init__('ros_panel_test_nodes')

        self.pub_ = self.create_publisher(String, 'test_topic', 10)
        self.timer_ = self.create_timer(0.5, self._publish)

        self.srv_ = self.create_service(SetBool, 'test_set_bool', self._set_bool)

        self.action_ = ActionServer(self, Fibonacci, 'fibonacci', self._fibonacci)

        self.get_logger().info('ros_panel test nodes ready')

    def _publish(self):
        msg = String()
        msg.data = 'hello from ros_panel test node'
        self.pub_.publish(msg)

    def _set_bool(self, request, response):
        response.success = True
        response.message = f'received data={request.data}'
        return response

    def _fibonacci(self, goal_handle):
        n = goal_handle.request.order
        fb = Fibonacci.Feedback()
        seq = []
        a, b = 0, 1
        for _ in range(max(n, 0)):
            seq.append(a)
            a, b = b, a + b
            fb.sequence = seq[:]
            goal_handle.publish_feedback(fb)
            time.sleep(0.05)
        goal_handle.succeed()
        result = Fibonacci.Result()
        result.sequence = seq
        return result


def main():
    rclpy.init()
    node = TestNodes()
    executor = MultiThreadedExecutor()
    executor.add_node(node)
    try:
        executor.spin()
    finally:
        node.destroy_node()
        try:
            rclpy.shutdown()
        except Exception:
            pass


if __name__ == '__main__':
    main()