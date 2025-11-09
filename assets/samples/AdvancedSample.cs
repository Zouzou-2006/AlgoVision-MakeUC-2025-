// Advanced C# sample for AlgoVision testing.
// Exercises namespaces, interfaces, classes, structs, events, generics,
// local functions, switch expressions, and various control-flow constructs.

using System;
using System.Collections.Generic;
using System.Linq;

namespace Samples.Advanced
{
    public interface ILogger
    {
        void Log(string message);
    }

    public sealed class ConsoleLogger : ILogger
    {
        public void Log(string message) => Console.WriteLine($"[{DateTime.UtcNow:O}] {message}");
    }

    public struct Point
    {
        public int X { get; }
        public int Y { get; }

        public Point(int x, int y)
        {
            X = x;
            Y = y;
        }

        public override string ToString() => $"({X}, {Y})";
    }

    public class WorkflowContext
    {
        public string Name { get; init; } = "default";
        public IList<Point> Points { get; } = new List<Point>();
        public IDictionary<string, string> Metadata { get; } = new Dictionary<string, string>();

        public void AddPoint(int x, int y) => Points.Add(new Point(x, y));
    }

    public class Workflow
    {
        private readonly ILogger _logger;

        public event Action<string>? StepCompleted;

        public Workflow(ILogger logger)
        {
            _logger = logger;
        }

        public int Execute(IReadOnlyList<int> items, WorkflowContext context)
        {
            int checksum = 0;
            foreach (var value in items)
            {
                var classification = value switch
                {
                    < 0 => "negative",
                    0 => "zero",
                    _ when value % 2 == 0 => "even",
                    _ => "odd"
                };

                checksum += ProcessValue(value, classification, context);
            }

            StepCompleted?.Invoke(context.Name);
            return checksum;
        }

        private int ProcessValue(int value, string classification, WorkflowContext context)
        {
            _logger.Log($"Processing {value} ({classification})");

            if (classification == "negative")
            {
                return 0;
            }

            for (var i = 0; i < classification.Length; i++)
            {
                if (classification[i] == 'e')
                {
                    context.AddPoint(value, i);
                }
            }

            context.Metadata[classification] = value.ToString();

            int LocalComputation(int seed)
            {
                int Nested(int input) => input + 1;
                return Enumerable.Range(0, seed).Select(Nested).Sum();
            }

            return LocalComputation(Math.Abs(value));
        }
    }

    public static class Program
    {
        public static void Main()
        {
            var logger = new ConsoleLogger();
            var workflow = new Workflow(logger);
            workflow.StepCompleted += name => logger.Log($"Workflow '{name}' completed.");

            var context = new WorkflowContext { Name = "demo" };
            var checksum = workflow.Execute(new[] { -2, -1, 0, 1, 2, 3, 4 }, context);

            logger.Log($"Checksum: {checksum}");
            foreach (var point in context.Points)
            {
                logger.Log(point.ToString());
            }
        }
    }
}
